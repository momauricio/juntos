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

-- update: created_by is immutable; updated_by/updated_at are forced.
-- There is no client-settable flag to skip this: any real change is an edit.
-- Rating an already-done item never touches items (complete_item_with_rating
-- only updates items when status = 'want'), so it keeps updated_by/updated_at;
-- the first rating that moves want -> done IS an edit (updated_by = rater).
-- space_id changes are intentionally allowed: items_all_member's
-- WITH CHECK is_space_member(space_id) guarantees the new space is one the
-- user belongs to.
create function public.enforce_item_authorship()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row public.items%rowtype;
begin
  if new.created_by is distinct from old.created_by then
    raise exception 'created_by_immutable' using errcode = '23514';
  end if;

  -- no-op guard: an update that changes nothing (ignoring updated_by and
  -- updated_at) is not an edit and cannot stamp authorship or a fake date
  v_row := new;
  v_row.updated_by := old.updated_by;
  v_row.updated_at := old.updated_at;
  if v_row is not distinct from old then
    new.updated_by := old.updated_by;
    new.updated_at := old.updated_at;
    return new;
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

-- spaces: updated_at (backfilled before the trigger below exists)
alter table public.spaces add column updated_at timestamptz not null default now();

update public.spaces set updated_at = created_at;

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
  new.updated_at := now();
  return new;
end;
$$;

create trigger spaces_enforce_authorship
  before update on public.spaces
  for each row execute function public.enforce_space_authorship();
