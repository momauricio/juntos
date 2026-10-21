-- space member limit
create function public.enforce_space_member_limit()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  -- lock the space row so concurrent accepts for the same space are serialized
  -- and the count below sees the other transaction's committed member
  perform 1 from public.spaces where id = new.space_id for update;

  if (select count(*) from public.space_members where space_id = new.space_id) >= 2 then
    raise exception 'space_full' using errcode = '23514';
  end if;

  return new;
end;
$$;

create trigger space_members_enforce_limit
  before insert on public.space_members
  for each row execute function public.enforce_space_member_limit();

-- grants
revoke execute on all functions in schema public from public, anon;

-- only the RPCs used by the app and the helpers used by policies.
-- PR6 RPCs must add their own grant to authenticated.
-- trigger functions need no EXECUTE grant: Postgres does not check EXECUTE
-- when invoking a trigger, and they cannot be called directly.
grant execute on function public.create_space_with_invite(text, text, timestamptz) to authenticated;
grant execute on function public.redeem_invite(text) to authenticated;
grant execute on function public.regenerate_invite(uuid, text, timestamptz) to authenticated;
grant execute on function public.complete_item_with_rating(uuid, int, int, int, int) to authenticated;
grant execute on function public.is_space_member(uuid) to authenticated;
grant execute on function public.space_member_count(uuid) to authenticated;

alter default privileges in schema public revoke execute on functions from public;
