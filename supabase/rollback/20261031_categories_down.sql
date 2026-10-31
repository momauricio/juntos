-- ATENÇÃO: desfaz supabase/migrations/20261031120000_categories.sql.
-- Só roda com OK do Mauricio. Fica fora de migrations/ de propósito.
--
-- O que se PERDE ao rodar:
--   * todas as categorias criadas pelo casal (e renomes, emojis, cores e ordem
--     das categorias padrão);
--   * as mudanças de categoria dos itens (items.category_id some);
--   * a preferência Grade/Compacta de cada pessoa (profiles.item_view).
-- O que NÃO muda: items.type e status (a migration nunca mexeu neles).
-- A extensão unaccent e o schema backup (com backup.items_before_categories_20261031)
-- ficam: outros objetos podem usar o unaccent e o backup serve de conferência.

begin;

drop trigger if exists items_fill_category on public.items;
drop trigger if exists items_category_same_space on public.items;
-- leva junto a FK e o índice items_category_id_idx
alter table public.items drop column if exists category_id;

drop trigger if exists spaces_seed_categories on public.spaces;
-- políticas e triggers de categories vão junto
drop table if exists public.categories;

alter table public.profiles drop column if exists item_view;

drop function if exists public.items_fill_category();
drop function if exists public.items_category_same_space();
drop function if exists public.spaces_seed_categories();
drop function if exists public.seed_default_categories(uuid);
drop function if exists public.categories_normalize();
drop function if exists public.categories_enforce_limit();
drop function if exists public.categories_prevent_delete_non_empty();
drop function if exists public.category_name_key(text);

-- switch_space_and_redeem volta ao corpo EXATO de
-- 20261023120000_space_lifecycle.sql (a versão nova referencia categories e
-- quebraria em runtime).
create or replace function public.switch_space_and_redeem(p_code text, p_bring_items boolean)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_invite public.invites%rowtype;
  v_old_space_id uuid;
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
      update public.items
      set space_id = v_invite.space_id
      where space_id = v_old_space_id;
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

-- Conferência: nenhum item mudou de tipo (tem que dar 0, senão volta tudo).
do $$
declare
  v_changed int;
begin
  select count(*) into v_changed
  from public.items i
  join backup.items_before_categories_20261031 b using (id)
  where i.type <> b.type;

  if v_changed > 0 then
    raise exception 'rollback_categories: % itens com type diferente do backup', v_changed;
  end if;
end;
$$;

-- Contagens (só para ler): logo depois da migration, as duas batem. Itens
-- criados ou apagados depois dela fazem a diferença.
select
  (select count(*) from public.items) as itens_agora,
  (select count(*) from backup.items_before_categories_20261031) as itens_no_backup,
  (select count(*) from public.items i
     join backup.items_before_categories_20261031 b using (id)
     where i.type <> b.type) as tipos_diferentes;

commit;
