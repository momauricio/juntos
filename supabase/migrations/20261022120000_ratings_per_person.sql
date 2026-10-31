-- Nota por pessoa: cada membro do espaço tem a própria linha em ratings.
-- As linhas existentes já têm rated_by = quem salvou, então viram a nota
-- individual dessa pessoa, sem reescala. Os checks 1–10 e ratings_shape
-- continuam como em 20261020120000_ratings_scale_1_10.sql.
alter table public.ratings
  drop constraint ratings_item_id_key;

alter table public.ratings
  add constraint ratings_item_person_key unique (item_id, rated_by);

alter table public.ratings
  add column comment text
    constraint ratings_comment_length check (char_length(comment) <= 280);

-- Todos do espaço leem as notas; cada um só grava, edita e apaga a própria.
-- O trigger enforce_rating_identity_and_shape segue forçando rated_by := auth.uid().
drop policy ratings_all_member on public.ratings;

create policy ratings_select_member on public.ratings
  for select using (
    exists (
      select 1 from public.items i
      where i.id = item_id and public.is_space_member(i.space_id)
    )
  );

create policy ratings_insert_own on public.ratings
  for insert with check (
    rated_by = auth.uid()
    and exists (
      select 1 from public.items i
      where i.id = item_id and public.is_space_member(i.space_id)
    )
  );

create policy ratings_update_own on public.ratings
  for update using (
    rated_by = auth.uid()
    and exists (
      select 1 from public.items i
      where i.id = item_id and public.is_space_member(i.space_id)
    )
  )
  with check (
    rated_by = auth.uid()
    and exists (
      select 1 from public.items i
      where i.id = item_id and public.is_space_member(i.space_id)
    )
  );

create policy ratings_delete_own on public.ratings
  for delete using (
    rated_by = auth.uid()
    and exists (
      select 1 from public.items i
      where i.id = item_id and public.is_space_member(i.space_id)
    )
  );

-- A assinatura muda (novo p_comment), então a antiga sai para não sobrar
-- uma sobrecarga que ainda faria upsert por item_id.
drop function public.complete_item_with_rating(uuid, int, int, int, int);

create function public.complete_item_with_rating(
  p_item_id uuid,
  p_food int default null,
  p_service int default null,
  p_ambiance int default null,
  p_score int default null,
  p_comment text default null
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
  v_comment text := nullif(trim(p_comment), '');
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
      or p_food not between 1 and 10
      or p_service not between 1 and 10
      or p_ambiance not between 1 and 10
      or p_score is not null then
      raise exception 'restaurant_rating_shape' using errcode = '23514';
    end if;
  elsif p_score is null
    or p_score not between 1 and 10
    or p_food is not null
    or p_service is not null
    or p_ambiance is not null then
    raise exception 'standard_rating_shape' using errcode = '23514';
  end if;

  if char_length(v_comment) > 280 then
    raise exception 'comment_too_long' using errcode = '23514';
  end if;

  insert into public.ratings (
    item_id,
    rated_by,
    food,
    service,
    ambiance,
    score,
    comment,
    updated_at
  )
  values (
    p_item_id,
    v_uid,
    p_food,
    p_service,
    p_ambiance,
    p_score,
    v_comment,
    v_now
  )
  on conflict (item_id, rated_by) do update
  set food = excluded.food,
      service = excluded.service,
      ambiance = excluded.ambiance,
      score = excluded.score,
      comment = excluded.comment,
      updated_at = v_now;

  -- Só a primeira nota (de qualquer um) marca o item; as seguintes não
  -- mexem em status nem em completed_at.
  if v_item.status = 'want' then
    update public.items
    set status = 'done',
        completed_at = v_now,
        updated_at = v_now
    where id = p_item_id;
  end if;
end;
$$;

revoke execute on function public.complete_item_with_rating(
  uuid,
  int,
  int,
  int,
  int,
  text
) from public, anon;

grant execute on function public.complete_item_with_rating(
  uuid,
  int,
  int,
  int,
  int,
  text
) to authenticated;
