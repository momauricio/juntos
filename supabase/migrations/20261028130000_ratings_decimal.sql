-- Nota com uma casa decimal (ex.: 8,2), mesma escala 1 a 10.
-- integer -> numeric(3,1) é conversão sem perda: as notas inteiras viram 8.0
-- e continuam válidas. O app antigo segue mandando inteiros, que passam nos
-- checks e na RPC nova (mesmos nomes de parâmetro).
-- ratings_shape só olha "is null / is not null" das colunas e fica como está.
alter table public.ratings
  drop constraint ratings_food_check,
  drop constraint ratings_service_check,
  drop constraint ratings_ambiance_check,
  drop constraint ratings_score_check;

alter table public.ratings
  alter column food type numeric(3,1) using food::numeric(3,1),
  alter column service type numeric(3,1) using service::numeric(3,1),
  alter column ambiance type numeric(3,1) using ambiance::numeric(3,1),
  alter column score type numeric(3,1) using score::numeric(3,1);

-- enforce_rating_identity_and_shape também só testa null, mas o plpgsql guarda
-- o plano do trigger por conexão com o tipo antigo (integer): conexões que já
-- rodaram o trigger (pool do PostgREST) passariam a falhar com "type of
-- parameter ... does not match that when preparing the plan". Recriar com o
-- MESMO corpo de 20260728015342_init.sql força a recompilação em todas.
create or replace function public.enforce_rating_identity_and_shape()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid;
  v_item_type text;
begin
  v_uid := auth.uid();
  if v_uid is null then
    raise exception 'not_authenticated';
  end if;

  new.rated_by := v_uid;

  select i.type into v_item_type
  from public.items i
  where i.id = new.item_id;

  if v_item_type is null then
    raise exception 'invalid_item' using errcode = '23503';
  end if;

  if v_item_type = 'restaurant' then
    if new.food is null
      or new.service is null
      or new.ambiance is null
      or new.score is not null then
      raise exception 'restaurant_rating_shape' using errcode = '23514';
    end if;
  elsif new.score is null
    or new.food is not null
    or new.service is not null
    or new.ambiance is not null then
    raise exception 'standard_rating_shape' using errcode = '23514';
  end if;

  return new;
end;
$$;

-- numeric(3,1) já arredonda para 1 casa ao gravar; o "= round(col, 1)" deixa
-- a regra explícita caso o tipo da coluna mude no futuro.
alter table public.ratings
  add constraint ratings_food_check
    check (food between 1 and 10 and food = round(food, 1)),
  add constraint ratings_service_check
    check (service between 1 and 10 and service = round(service, 1)),
  add constraint ratings_ambiance_check
    check (ambiance between 1 and 10 and ambiance = round(ambiance, 1)),
  add constraint ratings_score_check
    check (score between 1 and 10 and score = round(score, 1));

-- Os parâmetros viram numeric (sem precisão, para a RPC recusar 8.25 em vez
-- de arredondar em silêncio). create or replace não troca tipo de parâmetro,
-- então a versão integer sai; mesmos nomes, defaults, corpo e erros de
-- 20261022120000_ratings_per_person.sql, mais a checagem de 1 casa.
drop function public.complete_item_with_rating(uuid, int, int, int, int, text);

create function public.complete_item_with_rating(
  p_item_id uuid,
  p_food numeric default null,
  p_service numeric default null,
  p_ambiance numeric default null,
  p_score numeric default null,
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
      or round(p_food, 1) <> p_food
      or round(p_service, 1) <> p_service
      or round(p_ambiance, 1) <> p_ambiance
      or p_score is not null then
      raise exception 'restaurant_rating_shape' using errcode = '23514';
    end if;
  elsif p_score is null
    or p_score not between 1 and 10
    or round(p_score, 1) <> p_score
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
  numeric,
  numeric,
  numeric,
  numeric,
  text
) from public, anon;

grant execute on function public.complete_item_with_rating(
  uuid,
  numeric,
  numeric,
  numeric,
  numeric,
  text
) to authenticated;
