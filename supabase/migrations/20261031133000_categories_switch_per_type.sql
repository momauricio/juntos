-- Categorias: ajustes na troca de espaço com itens (switch_space_and_redeem).
-- Roda depois de 20261031130000_categories_switch_fallback.sql, que fica como
-- está (já aplicada). Só recria switch_space_and_redeem: mesma assinatura,
-- mesmo retorno e mesmos grants; compatível com o app do main, que só chama a
-- RPC. Nenhuma tabela, trigger, dado ou outra função muda.
-- Duas mudanças (decididas pelo designer):
-- a) Padrão de cada tipo quando nenhuma padrão existe. Antes, se a categoria
--    não cabia e o espaço novo não tinha nenhuma padrão, o primeiro tipo
--    recriava a padrão dele e os outros tipos caíam nela pela regra "primeira
--    padrão que existir" (um restaurante ia parar em "Filme"). Agora essa regra
--    só considera as padrões que já existiam no espaço novo antes da troca; sem
--    nenhuma, cada tipo recria a sua (ensure_default_category).
-- b) Categoria vazia só ocupa vaga se sobrar vaga. Antes as categorias do
--    espaço antigo iam em ordem de position, e uma vazia que não batia com
--    nenhuma do novo podia tomar uma das 30 vagas de uma categoria com itens.
--    Agora vão primeiro as que têm itens e depois as vazias (cada grupo por
--    position, created_at); vazia sem nome igual só é criada se ainda houver
--    vaga, senão não vai.
-- Volta: supabase/rollback/20261031133000_categories_switch_per_type_down.sql
-- (antes do rollback de 20261031130000 e do de categories; só com OK do
-- Mauricio).

begin;

-- Mesmo corpo de 20261031130000_categories_switch_fallback.sql, mais:
-- categorias com itens antes das vazias; vazia que não cabe não vai; a
-- "primeira padrão que existir" é só entre as padrões de antes da troca.
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
  v_has_items boolean;
  v_new_category_id uuid;
  v_type text;
  v_prior_default_ids uuid[];
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

      -- Padrões do espaço novo antes da troca. As recriadas abaixo por
      -- ensure_default_category não entram: sem nenhuma padrão, cada tipo
      -- recria a sua em vez de cair na de outro tipo.
      select coalesce(array_agg(c.id), '{}') into v_prior_default_ids
      from public.categories c
      where c.space_id = v_invite.space_id
        and c.created_by is null;

      -- Com itens primeiro: uma vazia não toma a vaga de uma com itens.
      for v_category in
        select c.* from public.categories c
        where c.space_id = v_old_space_id
        order by not exists (select 1 from public.items i
                             where i.space_id = v_old_space_id
                               and i.category_id = c.id),
                 c.position, c.created_at
      loop
        v_new_category_id := null;

        v_has_items := exists (select 1 from public.items i
                               where i.space_id = v_old_space_id
                                 and i.category_id = v_category.id);

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

        -- Vazia que não coube: não vai (não tem item para levar).
        if not v_has_items then
          continue;
        end if;

        -- Não coube: um destino por tipo de item dessa categoria.
        for v_type in
          select distinct i.type from public.items i
          where i.space_id = v_old_space_id
            and i.category_id = v_category.id
          order by i.type
        loop
          v_new_category_id := null;

          -- padrão do tipo (inclusive uma recriada nesta troca)
          select c.id into v_new_category_id
          from public.categories c
          where c.space_id = v_invite.space_id
            and c.created_by is null
            and c.item_type = v_type
          order by c.position, c.created_at
          limit 1;

          -- primeira padrão que já existia antes da troca
          if v_new_category_id is null then
            select c.id into v_new_category_id
            from public.categories c
            where c.space_id = v_invite.space_id
              and c.created_by is null
              and c.id = any (v_prior_default_ids)
            order by c.position, c.created_at
            limit 1;
          end if;

          -- nenhuma padrão de antes: recria a do tipo (mesmo passando de 30)
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

commit;
