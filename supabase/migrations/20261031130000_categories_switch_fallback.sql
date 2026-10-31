-- Categorias: a troca de espaço nunca falha inteira (spec-layout-categorias.md).
-- Roda depois de 20261031120000_categories.sql, que fica como está (pode já
-- ter sido aplicada).
-- 1) categories_normalize / categories_enforce_limit: inserção "do sistema"
--    (juntos.system_category = 'on' na transação) fica sem autor e fora do
--    limite de 30;
-- 2) ensure_default_category: devolve (ou recria) a categoria padrão de um tipo;
-- 3) items_fill_category: sem categoria do tipo no espaço, recria a padrão em
--    vez de falhar (import_trello_items, app antigo);
-- 4) switch_space_and_redeem: categoria que não cabe no espaço novo manda os
--    itens para uma padrão; nenhum item fica para trás.
-- Volta: supabase/rollback/20261031130000_categories_switch_fallback_down.sql
-- (antes de 20261031_categories_down.sql; só com OK do Mauricio).

begin;

-- 1. Inserção do sistema ----------------------------------------------------
-- Só ensure_default_category liga juntos.system_category (set_config local à
-- transação) e desliga logo depois do insert. O app não tem como ligar: o
-- PostgREST não expõe set_config nem SET.
create or replace function public.categories_normalize()
returns trigger
language plpgsql
security definer
set search_path = public, extensions
as $$
begin
  -- o check de 1 a 24 caracteres roda depois do trigger, já com o trim
  new.name := trim(new.name);
  new.name_key := public.category_name_key(new.name);

  if tg_op = 'INSERT' then
    -- o lock do espaço (categories_enforce_limit, que roda antes) serializa o max
    new.position := coalesce(
      new.position,
      (select max(c.position) + 1 from public.categories c where c.space_id = new.space_id),
      1
    );
    -- profundidade > 1 = semeadura disparada pelo trigger de spaces (categoria
    -- padrão, sem autor). Na migration auth.uid() é null. Inserção do sistema
    -- (ensure_default_category) também é padrão, sem autor.
    if pg_trigger_depth() > 1
       or coalesce(current_setting('juntos.system_category', true), '') = 'on' then
      new.created_by := null;
    else
      new.created_by := auth.uid();
    end if;
    return new;
  end if;

  if new.space_id is distinct from old.space_id then
    raise exception 'category_space_immutable' using errcode = '23514';
  end if;
  if new.item_type is distinct from old.item_type then
    raise exception 'category_item_type_immutable' using errcode = '23514';
  end if;
  if new.created_by is distinct from old.created_by then
    raise exception 'created_by_immutable' using errcode = '23514';
  end if;

  new.updated_at := now();
  return new;
end;
$$;

-- No máximo 30 por espaço, exceto na inserção do sistema (recriar a padrão
-- para não perder item). O lock continua nos dois casos.
create or replace function public.categories_enforce_limit()
returns trigger
language plpgsql
security definer
set search_path = public, extensions
as $$
begin
  perform 1 from public.spaces where id = new.space_id for update;

  if coalesce(current_setting('juntos.system_category', true), '') = 'on' then
    return new;
  end if;

  if (select count(*) from public.categories where space_id = new.space_id) >= 30 then
    raise exception 'category_limit' using errcode = '23514';
  end if;

  return new;
end;
$$;

-- 2. ensure_default_category ------------------------------------------------
-- Devolve a categoria padrão (semeada, created_by null) do tipo no espaço; se
-- não existir mais, recria com os dados de seed_default_categories no fim da
-- ordem, sem autor e mesmo passando de 30. Devolve null para tipo desconhecido.
create function public.ensure_default_category(p_space_id uuid, p_type text)
returns uuid
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_id uuid;
  v_name text;
  v_emoji text;
  v_color text;
begin
  select c.id into v_id
  from public.categories c
  where c.space_id = p_space_id
    and c.item_type = p_type
    and c.created_by is null
  order by c.position, c.created_at
  limit 1;

  if v_id is not null then
    return v_id;
  end if;

  -- Igual a seed_default_categories.
  select d.name, d.emoji, d.color into v_name, v_emoji, v_color
  from (values
    ('stay', 'Hospedagem', '🏨', 'ph8'),
    ('restaurant', 'Restaurante', '🍝', 'ph3'),
    ('tourist_spot', 'Passeio', '🏖️', 'ph2'),
    ('activity', 'Programa', '🧺', 'ph5'),
    ('food_idea', 'Comida', '☕', 'ph1'),
    ('city', 'Cidade', '🏙️', 'ph4'),
    ('movie', 'Filme', '🎬', 'ph6'),
    ('event', 'Evento', '🎟️', 'ph7')
  ) as d (item_type, name, emoji, color)
  where d.item_type = p_type;

  if v_name is null then
    return null;
  end if;

  -- Mesmo lock de categories_enforce_limit: duas chamadas concorrentes não
  -- recriam a mesma padrão duas vezes (a segunda acha a da primeira).
  perform 1 from public.spaces where id = p_space_id for update;

  select c.id into v_id
  from public.categories c
  where c.space_id = p_space_id
    and (
      (c.item_type = p_type and c.created_by is null)
      -- O nome padrão já é de uma categoria do casal (ex.: criaram
      -- "Restaurante" depois de apagar a padrão): não cria outra (o name_key é
      -- único) e usa essa. O item mantém o type, então a nota não muda.
      or c.name_key = public.category_name_key(v_name)
    )
  order by (c.created_by is not null), c.position, c.created_at
  limit 1;

  if v_id is not null then
    return v_id;
  end if;

  perform set_config('juntos.system_category', 'on', true);

  -- position omitida: o trigger põe no fim da ordem
  insert into public.categories (space_id, name, emoji, color, item_type)
  values (p_space_id, v_name, v_emoji, v_color, p_type)
  returning id into v_id;

  perform set_config('juntos.system_category', 'off', true);

  return v_id;
end;
$$;

-- 3. items_fill_category ----------------------------------------------------
-- Insert sem category_id (app antigo durante o deploy, import_trello_items,
-- complete_item_with_rating, onboarding) recebe a categoria do tipo.
-- Prefere a semeada (created_by null): uma categoria própria "Pubs"
-- (item_type activity) colocada antes de Programa não rouba esses itens.
-- Sem nenhuma categoria do tipo (o casal apagou a padrão), recria a padrão.
create or replace function public.items_fill_category()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.category_id is null then
    select c.id into new.category_id
    from public.categories c
    where c.space_id = new.space_id
      and c.item_type = new.type
    order by (c.created_by is not null), c.position, c.created_at
    limit 1;

    if new.category_id is null then
      new.category_id := public.ensure_default_category(new.space_id, new.type);
    end if;

    if new.category_id is null then
      raise exception 'category_required' using errcode = '23502';
    end if;
  end if;

  return new;
end;
$$;

-- 4. switch_space_and_redeem ------------------------------------------------
-- Mesmo corpo de 20261031120000_categories.sql, mais: categoria do espaço
-- antigo sem nome igual no novo e que não cabe nas 30 não é criada; os itens
-- dela vão, por tipo, para a padrão do tipo, senão a primeira padrão do
-- espaço novo, senão a padrão do tipo recriada (ensure_default_category).
-- Mapa (categoria antiga, tipo) -> categoria nova (tipo null = todos) e um
-- update só. Se ainda sobrar item no espaço antigo, aborta tudo.
create or replace function public.switch_space_and_redeem(p_code text, p_bring_items boolean)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_invite public.invites%rowtype;
  v_old_space_id uuid;
  v_category public.categories%rowtype;
  v_new_category_id uuid;
  v_type text;
  v_old_ids uuid[] := '{}';
  v_types text[] := '{}';
  v_new_ids uuid[] := '{}';
begin
  if auth.uid() is null then
    raise exception 'not_authenticated';
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
  if public.space_member_count(v_invite.space_id) >= 2 then
    raise exception 'space_full';
  end if;

  select space_id into v_old_space_id
  from public.space_members
  where user_id = auth.uid();

  if v_old_space_id = v_invite.space_id then
    raise exception 'own_invite';
  end if;

  if v_old_space_id is not null then
    perform 1 from public.spaces where id = v_old_space_id for update;

    if public.space_member_count(v_old_space_id) > 1 then
      raise exception 'space_has_partner';
    end if;

    if p_bring_items then
      -- o mesmo lock de categories_enforce_limit: a contagem abaixo vale até o fim
      perform 1 from public.spaces where id = v_invite.space_id for update;

      for v_category in
        select * from public.categories
        where space_id = v_old_space_id
        order by position, created_at
      loop
        v_new_category_id := null;

        select c.id into v_new_category_id
        from public.categories c
        where c.space_id = v_invite.space_id
          and c.name_key = v_category.name_key;

        if v_new_category_id is null
           and (select count(*) from public.categories
                where space_id = v_invite.space_id) < 30 then
          -- position omitida: o trigger põe no fim da ordem do espaço novo
          insert into public.categories (space_id, name, emoji, color, item_type)
          values (v_invite.space_id, v_category.name, v_category.emoji,
                  v_category.color, v_category.item_type)
          returning id into v_new_category_id;
        end if;

        if v_new_category_id is not null then
          v_old_ids := v_old_ids || v_category.id;
          v_types := v_types || null::text;
          v_new_ids := v_new_ids || v_new_category_id;
          continue;
        end if;

        -- Não coube: um destino por tipo de item dessa categoria. Uma padrão
        -- recriada para um tipo já conta como "padrão que existe" para o próximo.
        for v_type in
          select distinct i.type from public.items i
          where i.space_id = v_old_space_id
            and i.category_id = v_category.id
          order by i.type
        loop
          v_new_category_id := null;

          -- padrão do tipo
          select c.id into v_new_category_id
          from public.categories c
          where c.space_id = v_invite.space_id
            and c.created_by is null
            and c.item_type = v_type
          order by c.position, c.created_at
          limit 1;

          -- primeira padrão que existir
          if v_new_category_id is null then
            select c.id into v_new_category_id
            from public.categories c
            where c.space_id = v_invite.space_id
              and c.created_by is null
            order by c.position, c.created_at
            limit 1;
          end if;

          -- nenhuma padrão: recria a do tipo (mesmo passando de 30)
          if v_new_category_id is null then
            v_new_category_id := public.ensure_default_category(v_invite.space_id, v_type);
          end if;

          v_old_ids := v_old_ids || v_category.id;
          v_types := v_types || v_type;
          v_new_ids := v_new_ids || v_new_category_id;
        end loop;
      end loop;

      update public.items i
      set space_id = v_invite.space_id,
          category_id = m.new_id
      from unnest(v_old_ids, v_types, v_new_ids) as m (old_id, item_type, new_id)
      where i.space_id = v_old_space_id
        and i.category_id = m.old_id
        and (m.item_type is null or m.item_type = i.type);

      -- Defensivo: não deve acontecer. Melhor falhar do que perder item no
      -- cascade do delete abaixo.
      if exists (select 1 from public.items where space_id = v_old_space_id) then
        raise exception 'switch_items_left_behind';
      end if;
    end if;

    delete from public.spaces where id = v_old_space_id;
  end if;

  insert into public.space_members (space_id, user_id, role)
  values (v_invite.space_id, auth.uid(), 'member');

  update public.invites
  set redeemed_at = now(), redeemed_by = auth.uid()
  where id = v_invite.id;

  return v_invite.space_id;
end;
$$;

revoke execute on function public.switch_space_and_redeem(text, boolean) from public, anon;
grant execute on function public.switch_space_and_redeem(text, boolean) to authenticated;

-- 5. Grants -----------------------------------------------------------------
-- create or replace mantém os revokes de 20261031120000_categories.sql nas
-- funções recriadas; a nova é interna.
revoke execute on function public.ensure_default_category(uuid, text) from public, anon, authenticated;

commit;
