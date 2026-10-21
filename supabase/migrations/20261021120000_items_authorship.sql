-- items: updated_by
alter table public.items add column updated_by uuid references auth.users (id);

update public.items set updated_by = created_by where updated_by is null;

-- insert: created_by and updated_by are always the authenticated user
create or replace function public.force_item_created_by()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid;
begin
  v_uid := auth.uid();
  if v_uid is null then
    raise exception 'not_authenticated';
  end if;

  new.created_by := v_uid;
  new.updated_by := v_uid;
  return new;
end;
$$;

-- update: created_by is immutable; updated_by/updated_at are forced
-- (space_id changes are intentionally allowed)
create function public.enforce_item_authorship()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.created_by is distinct from old.created_by then
    raise exception 'created_by_immutable' using errcode = '23514';
  end if;

  new.updated_by := auth.uid();
  new.updated_at := now();
  return new;
end;
$$;

create trigger items_enforce_authorship
  before update on public.items
  for each row execute function public.enforce_item_authorship();

-- spaces: updated_by
alter table public.spaces add column updated_by uuid references auth.users (id) default auth.uid();

update public.spaces set updated_by = created_by where updated_by is null;

create function public.enforce_space_authorship()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.created_by is distinct from old.created_by then
    raise exception 'created_by_immutable' using errcode = '23514';
  end if;

  new.updated_by := auth.uid();
  return new;
end;
$$;

create trigger spaces_enforce_authorship
  before update on public.spaces
  for each row execute function public.enforce_space_authorship();
