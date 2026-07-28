-- profiles
create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  display_name text not null,
  created_at timestamptz not null default now()
);

create function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, display_name)
  values (
    new.id,
    coalesce(split_part(new.email, '@', 1), 'eu')
  );
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- spaces
create table public.spaces (
  id uuid primary key default gen_random_uuid(),
  name text not null default 'Nós dois',
  created_by uuid not null references auth.users (id),
  created_at timestamptz not null default now()
);

create table public.space_members (
  space_id uuid not null references public.spaces (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  role text not null check (role in ('owner', 'member')),
  joined_at timestamptz not null default now(),
  primary key (space_id, user_id)
);

create unique index space_members_user_unique on public.space_members (user_id);
-- v1: each user belongs to at most one space

create table public.invites (
  id uuid primary key default gen_random_uuid(),
  space_id uuid not null references public.spaces (id) on delete cascade,
  code text not null unique,
  created_by uuid not null references auth.users (id),
  expires_at timestamptz not null,
  redeemed_at timestamptz,
  redeemed_by uuid references auth.users (id),
  created_at timestamptz not null default now()
);

create table public.items (
  id uuid primary key default gen_random_uuid(),
  space_id uuid not null references public.spaces (id) on delete cascade,
  type text not null check (type in ('restaurant','food_idea','tourist_spot','movie','city')),
  title text not null check (char_length(trim(title)) > 0),
  url text,
  notes text,
  status text not null default 'want' check (status in ('want','done')),
  created_by uuid not null references auth.users (id),
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.ratings (
  id uuid primary key default gen_random_uuid(),
  item_id uuid not null unique references public.items (id) on delete cascade,
  rated_by uuid not null references auth.users (id),
  food int check (food between 1 and 5),
  service int check (service between 1 and 5),
  ambiance int check (ambiance between 1 and 5),
  score int check (score between 1 and 5),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint ratings_shape check (
    (food is not null and service is not null and ambiance is not null and score is null)
    or
    (score is not null and food is null and service is null and ambiance is null)
  )
);

-- helpers
create function public.is_space_member(p_space_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.space_members m
    where m.space_id = p_space_id and m.user_id = auth.uid()
  );
$$;

create function public.space_member_count(p_space_id uuid)
returns int
language sql
stable
security definer
set search_path = public
as $$
  select count(*)::int from public.space_members where space_id = p_space_id;
$$;

-- RLS
alter table public.profiles enable row level security;
alter table public.spaces enable row level security;
alter table public.space_members enable row level security;
alter table public.invites enable row level security;
alter table public.items enable row level security;
alter table public.ratings enable row level security;

create policy profiles_select_self on public.profiles
  for select using (id = auth.uid() or id in (
    select m2.user_id from public.space_members m1
    join public.space_members m2 on m1.space_id = m2.space_id
    where m1.user_id = auth.uid()
  ));

create policy profiles_update_self on public.profiles
  for update using (id = auth.uid());

create policy spaces_select_member on public.spaces
  for select using (public.is_space_member(id));

create policy space_members_select on public.space_members
  for select using (public.is_space_member(space_id));

create policy invites_select_member on public.invites
  for select using (public.is_space_member(space_id));

create policy items_all_member on public.items
  for all using (public.is_space_member(space_id))
  with check (public.is_space_member(space_id));

create policy ratings_all_member on public.ratings
  for all using (
    exists (
      select 1 from public.items i
      where i.id = item_id and public.is_space_member(i.space_id)
    )
  )
  with check (
    exists (
      select 1 from public.items i
      where i.id = item_id and public.is_space_member(i.space_id)
    )
  );

-- RPCs
create function public.create_space_with_invite(p_name text, p_code text, p_expires_at timestamptz)
returns table (space_id uuid, invite_code text)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_space_id uuid;
begin
  if auth.uid() is null then
    raise exception 'not_authenticated';
  end if;
  if exists (select 1 from public.space_members where user_id = auth.uid()) then
    raise exception 'already_in_space';
  end if;

  insert into public.spaces (name, created_by)
  values (coalesce(nullif(trim(p_name), ''), 'Nós dois'), auth.uid())
  returning id into v_space_id;

  insert into public.space_members (space_id, user_id, role)
  values (v_space_id, auth.uid(), 'owner');

  insert into public.invites (space_id, code, created_by, expires_at)
  values (v_space_id, upper(p_code), auth.uid(), p_expires_at);

  return query select v_space_id, upper(p_code);
end;
$$;

create function public.redeem_invite(p_code text)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_invite public.invites%rowtype;
  v_count int;
begin
  if auth.uid() is null then
    raise exception 'not_authenticated';
  end if;
  if exists (select 1 from public.space_members where user_id = auth.uid()) then
    raise exception 'already_in_space';
  end if;

  select * into v_invite
  from public.invites
  where code = upper(trim(p_code))
  for update;

  if not found then
    raise exception 'invalid_invite';
  end if;
  if v_invite.redeemed_at is not null then
    raise exception 'invite_used';
  end if;
  if v_invite.expires_at <= now() then
    raise exception 'invite_expired';
  end if;

  select count(*) into v_count from public.space_members where space_id = v_invite.space_id;
  if v_count >= 2 then
    raise exception 'space_full';
  end if;

  insert into public.space_members (space_id, user_id, role)
  values (v_invite.space_id, auth.uid(), 'member');

  update public.invites
  set redeemed_at = now(), redeemed_by = auth.uid()
  where id = v_invite.id;

  return v_invite.space_id;
end;
$$;

create function public.regenerate_invite(p_space_id uuid, p_code text, p_expires_at timestamptz)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_count int;
begin
  if not public.is_space_member(p_space_id) then
    raise exception 'forbidden';
  end if;
  select count(*) into v_count from public.space_members where space_id = p_space_id;
  if v_count >= 2 then
    raise exception 'space_full';
  end if;

  delete from public.invites
  where space_id = p_space_id and redeemed_at is null;

  insert into public.invites (space_id, code, created_by, expires_at)
  values (p_space_id, upper(p_code), auth.uid(), p_expires_at);

  return upper(p_code);
end;
$$;

grant execute on function public.create_space_with_invite(text, text, timestamptz) to authenticated;
grant execute on function public.redeem_invite(text) to authenticated;
grant execute on function public.regenerate_invite(uuid, text, timestamptz) to authenticated;
