-- Categorias: na troca de espaço cada tipo vai sempre para a padrão dele.
-- Roda depois de 20261031133000_categories_switch_per_type.sql, que fica como
-- está (já aplicada). Só recria switch_space_and_redeem: mesma assinatura,
-- mesmo retorno, security definer, search_path e grants; compatível com o app
-- do main, que só chama a RPC. Nenhuma tabela, trigger, dado ou outra função
-- muda.
--
-- Mudança (decisão de produto: restaurante nunca cai em "Filme"):
-- quando uma categoria do espaço antigo não tem nome igual no novo e não cabe
-- nas 30, os itens dela vão, por tipo, SEMPRE para a padrão daquele tipo no
-- espaço novo (a semeada, created_by null, com aquele item_type). Se ela não
-- existe mais, é recriada por ensure_default_category, MESMO que exista padrão
-- de outro tipo. Sai por completo a regra "primeira padrão que existir" (e com
-- ela v_prior_default_ids), que em 20261031133000 ainda mandava um restaurante
-- para "Filme" quando Filme era a única padrão de antes da troca.
-- O resto fica igual a 20261031133000: categorias com itens primeiro, depois
-- as vazias; vazia sem nome igual só é criada se houver vaga (< 30).
--
-- Limite de 30: ensure_default_category usa a inserção do sistema
-- (juntos.system_category, 20261031130000), que categories_enforce_limit deixa
-- passar de 30. Recriar a padrão de um tipo com itens nunca falha por limite;
-- o espaço novo pode ficar com 31+ (uma por tipo recriado). O casal continua
-- sem poder criar categoria acima de 30.
--
-- Caso extremo (sem mudança): se o nome padrão (ex.: "Restaurante") já é de
-- uma categoria do casal com OUTRO item_type, ensure_default_category devolve
-- essa categoria: name_key é único no espaço e não há como criar outra com o
-- mesmo nome. O item mantém o type (e a nota); só fica nessa categoria.
--
-- Volta: supabase/rollback/20261031134500_categories_switch_per_type_strict_down.sql
-- (antes dos rollbacks de 20261031133000, 20261031130000 e categories; só com
-- OK do Mauricio).

begin;

-- Mesmo corpo de 20261031133000_categories_switch_per_type.sql, menos a regra
-- "primeira padrão que existir": sem a padrão do tipo, recria a do tipo.
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

        -- Não coube: cada tipo vai para a padrão DELE (nunca para a de outro
        -- tipo).
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

          -- sem a padrão do tipo: recria (mesmo passando de 30, mesmo que
          -- exista padrão de outro tipo)
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
