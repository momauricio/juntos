-- ATENÇÃO: desfaz supabase/migrations/20261031130000_categories_switch_fallback.sql.
-- Só roda com OK do Mauricio. Fica fora de migrations/ de propósito.
-- Para desfazer as categorias inteiras: rode este arquivo e DEPOIS
-- supabase/rollback/20261031_categories_down.sql.
--
-- Volta categories_normalize, categories_enforce_limit, items_fill_category e
-- switch_space_and_redeem às versões EXATAS de
-- 20261031120000_categories.sql e apaga ensure_default_category.
-- O que NÃO se perde: categorias padrão recriadas pela migration (ficam como
-- categorias padrão comuns) e itens (nenhum item muda). Um espaço que passou
-- de 30 com uma padrão recriada continua com 31 ou mais; só não cria outra
-- enquanto não voltar a menos de 30.
-- Depois disto, a troca de espaço volta a falhar com category_limit quando a
-- categoria não cabe, e insert sem categoria do tipo volta a falhar com
-- category_required.

begin;

-- 1. Inserção do sistema sai (versões do PR 1) ----------------------------
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
    -- padrão, sem autor). Na migration auth.uid() é null.
    if pg_trigger_depth() > 1 then
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

create or replace function public.categories_enforce_limit()
returns trigger
language plpgsql
security definer
set search_path = public, extensions
as $$
begin
  perform 1 from public.spaces where id = new.space_id for update;

  if (select count(*) from public.categories where space_id = new.space_id) >= 30 then
    raise exception 'category_limit' using errcode = '23514';
  end if;

  return new;
end;
$$;

-- 2. items_fill_category volta a falhar sem categoria do tipo -------------
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
      raise exception 'category_required' using errcode = '23502';
    end if;
  end if;

  return new;
end;
$$;

-- 3. switch_space_and_redeem do PR 1 --------------------------------------
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
  v_old_ids uuid[] := '{}';
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

        if v_new_category_id is null then
          -- position omitida: o trigger põe no fim da ordem do espaço novo
          insert into public.categories (space_id, name, emoji, color, item_type)
          values (v_invite.space_id, v_category.name, v_category.emoji,
                  v_category.color, v_category.item_type)
          returning id into v_new_category_id;
        end if;

        v_old_ids := v_old_ids || v_category.id;
        v_new_ids := v_new_ids || v_new_category_id;
      end loop;

      update public.items i
      set space_id = v_invite.space_id,
          category_id = m.new_id
      from unnest(v_old_ids, v_new_ids) as m (old_id, new_id)
      where i.space_id = v_old_space_id
        and i.category_id = m.old_id;
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

-- 4. Função nova -------------------------------------------------------------
-- Depois de items_fill_category, que era quem a chamava.
drop function if exists public.ensure_default_category(uuid, text);

commit;
