create function public.complete_item_with_rating(
  p_item_id uuid,
  p_food int default null,
  p_service int default null,
  p_ambiance int default null,
  p_score int default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid;
  v_item public.items%rowtype;
  v_now timestamptz := now();
begin
  v_uid := auth.uid();
  if v_uid is null then
    raise exception 'not_authenticated';
  end if;

  select * into v_item
  from public.items
  where id = p_item_id
  for update;

  if not found then
    raise exception 'invalid_item' using errcode = '23503';
  end if;

  if not public.is_space_member(v_item.space_id) then
    raise exception 'forbidden' using errcode = '42501';
  end if;

  if v_item.type = 'restaurant' then
    if p_food is null
      or p_service is null
      or p_ambiance is null
      or p_food not between 1 and 5
      or p_service not between 1 and 5
      or p_ambiance not between 1 and 5
      or p_score is not null then
      raise exception 'restaurant_rating_shape' using errcode = '23514';
    end if;
  elsif p_score is null
    or p_score not between 1 and 5
    or p_food is not null
    or p_service is not null
    or p_ambiance is not null then
    raise exception 'standard_rating_shape' using errcode = '23514';
  end if;

  insert into public.ratings (
    item_id,
    rated_by,
    food,
    service,
    ambiance,
    score,
    updated_at
  )
  values (
    p_item_id,
    v_uid,
    p_food,
    p_service,
    p_ambiance,
    p_score,
    v_now
  )
  on conflict (item_id) do update
  set rated_by = excluded.rated_by,
      food = excluded.food,
      service = excluded.service,
      ambiance = excluded.ambiance,
      score = excluded.score,
      updated_at = v_now;

  if v_item.status = 'want' then
    update public.items
    set status = 'done',
        completed_at = v_now,
        updated_at = v_now
    where id = p_item_id;
  end if;
end;
$$;

grant execute on function public.complete_item_with_rating(
  uuid,
  int,
  int,
  int,
  int
) to authenticated;
