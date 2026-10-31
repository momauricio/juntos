-- Categorias do casal (spec-layout-categorias.md, PR 1: só dados).
-- 1) backup dos itens antes da mudança (schema backup, sem acesso pelo app);
-- 2) unaccent + public.category_name_key (nome único sem acento/maiúscula/espaços);
-- 3) tabela public.categories com RLS, limite de 30, "só apaga vazia" e semeadura
--    das 8 categorias padrão (espaços existentes e todo espaço novo);
-- 4) items.category_id not null, preenchido pelo tipo, sem mexer em updated_at/updated_by;
-- 5) switch_space_and_redeem leva as categorias junto com os itens;
-- 6) profiles.item_view (Grade/Compacta por pessoa).
-- Volta: supabase/rollback/20261031_categories_down.sql (só com OK do Mauricio).

begin;

-- 1. Backup -----------------------------------------------------------------
create schema if not exists backup;
revoke all on schema backup from public, anon, authenticated;

create table backup.items_before_categories_20261031 as
  select id, space_id, type, status, created_at, updated_at, updated_by
  from public.items;

revoke all on table backup.items_before_categories_20261031 from public, anon, authenticated;

-- 2. unaccent ---------------------------------------------------------------
-- No remoto o unaccent pode já existir em outro schema (public ou extensions):
-- por isso as funções abaixo usam search_path = public, extensions e chamam
-- unaccent(...) sem qualificar.
create schema if not exists extensions;
create extension if not exists unaccent with schema extensions;

-- 3. Chave do nome ----------------------------------------------------------
-- "Pubs", "pubs" e " Púbs " viram "pubs". unaccent não é immutable, então a
-- chave é gravada por trigger (name_key) e não num índice de expressão.
create function public.category_name_key(p_name text)
returns text
language sql
stable
set search_path = public, extensions
as $$
  select lower(regexp_replace(unaccent(trim(p_name)), '\s+', ' ', 'g'));
$$;

-- 4. Tabela -----------------------------------------------------------------
create table public.categories (
  id uuid primary key default gen_random_uuid(),
  space_id uuid not null references public.spaces (id) on delete cascade,
  name text not null check (char_length(name) between 1 and 24),
  name_key text not null,
  emoji text not null check (char_length(emoji) between 1 and 16),
  color text not null check (color in ('ph1','ph2','ph3','ph4','ph5','ph6','ph7','ph8')),
  position int not null,
  -- Tipo que um item novo criado nessa categoria recebe (regras de nota).
  -- Padrão semeado: o próprio tipo; criada pelo casal: 'activity'.
  item_type text not null default 'activity'
    check (item_type in ('restaurant','food_idea','tourist_spot','movie','city','event','activity','stay')),
  -- null nas categorias padrão semeadas
  created_by uuid null references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint categories_space_name_key_unique unique (space_id, name_key)
);

create index categories_space_position_idx on public.categories (space_id, position);

-- 5. Triggers de categories -------------------------------------------------
-- Normaliza nome/chave, completa position e created_by no insert e trava
-- space_id, item_type e created_by no update.
create function public.categories_normalize()
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

create trigger categories_normalize
  before insert or update on public.categories
  for each row execute function public.categories_normalize();

-- No máximo 30 por espaço. O lock na linha do espaço serializa inserts
-- concorrentes (mesmo padrão de enforce_space_member_limit).
create function public.categories_enforce_limit()
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

create trigger categories_enforce_limit
  before insert on public.categories
  for each row execute function public.categories_enforce_limit();

-- Só apaga categoria vazia (C1). A FK items.category_id (no action) também
-- garante, mas este trigger dá um erro com nome para o app.
-- Exceção: quando o próprio espaço está sendo apagado (leave_space,
-- switch_space_and_redeem, delete from spaces), o cascade apaga itens e
-- categorias no mesmo comando. Nesse momento a linha de spaces já não existe;
-- se o cascade das categorias rodar antes do dos itens, os itens ainda estão
-- lá e o trigger bloquearia o delete do espaço. Por isso, sem espaço, deixa
-- passar: os itens vão junto pelo cascade de spaces -> items.
create function public.categories_prevent_delete_non_empty()
returns trigger
language plpgsql
security definer
set search_path = public, extensions
as $$
begin
  if not exists (select 1 from public.spaces where id = old.space_id) then
    return old;
  end if;

  if exists (select 1 from public.items where category_id = old.id) then
    raise exception 'category_not_empty' using errcode = '23503';
  end if;

  return old;
end;
$$;

-- 6. RLS --------------------------------------------------------------------
alter table public.categories enable row level security;

create policy categories_select_member on public.categories
  for select using (public.is_space_member(space_id));

create policy categories_insert_member on public.categories
  for insert with check (public.is_space_member(space_id));

create policy categories_update_member on public.categories
  for update using (public.is_space_member(space_id))
  with check (public.is_space_member(space_id));

create policy categories_delete_member on public.categories
  for delete using (public.is_space_member(space_id));

revoke all on public.categories from anon;
grant select, insert, update, delete on public.categories to authenticated;

-- 7. Semeadura --------------------------------------------------------------
-- As 8 categorias padrão (spec §3). Os nomes são os de TYPE_CHIP_LABELS.
-- Igual a DEFAULT_CATEGORIES em lib/categories.ts.
create function public.seed_default_categories(p_space_id uuid)
returns void
language plpgsql
security definer
set search_path = public, extensions
as $$
begin
  insert into public.categories (space_id, position, name, emoji, color, item_type)
  values
    (p_space_id, 1, 'Hospedagem', '🏨', 'ph8', 'stay'),
    (p_space_id, 2, 'Restaurante', '🍝', 'ph3', 'restaurant'),
    (p_space_id, 3, 'Passeio', '🏖️', 'ph2', 'tourist_spot'),
    (p_space_id, 4, 'Programa', '🧺', 'ph5', 'activity'),
    (p_space_id, 5, 'Comida', '☕', 'ph1', 'food_idea'),
    (p_space_id, 6, 'Cidade', '🏙️', 'ph4', 'city'),
    (p_space_id, 7, 'Filme', '🎬', 'ph6', 'movie'),
    (p_space_id, 8, 'Evento', '🎟️', 'ph7', 'event')
  on conflict (space_id, name_key) do nothing;
end;
$$;

-- Todo espaço novo (create_space_with_invite, demo, caminhos futuros) nasce
-- com as 8.
create function public.spaces_seed_categories()
returns trigger
language plpgsql
security definer
set search_path = public, extensions
as $$
begin
  perform public.seed_default_categories(new.id);
  return new;
end;
$$;

create trigger spaces_seed_categories
  after insert on public.spaces
  for each row execute function public.spaces_seed_categories();

-- Espaços que já existem.
select public.seed_default_categories(s.id) from public.spaces s;

-- 8. items.category_id ------------------------------------------------------
-- Sem "on delete": no action (o padrão), NÃO restrict. Assim o cascade de
-- spaces apaga itens e categorias no mesmo comando, e apagar categoria com
-- itens falha.
alter table public.items add column category_id uuid references public.categories (id);

-- items_enforce_authorship (before update) carimbaria updated_by = null e
-- updated_at = now() em todos os itens: desligado só durante o backfill.
alter table public.items disable trigger items_enforce_authorship;

update public.items i
set category_id = c.id
from public.categories c
where c.space_id = i.space_id
  and c.item_type = i.type
  and i.category_id is null;

alter table public.items enable trigger items_enforce_authorship;

do $$
declare
  v_missing int;
begin
  select count(*) into v_missing from public.items where category_id is null;
  if v_missing > 0 then
    raise exception 'categories_backfill: % itens sem categoria', v_missing;
  end if;
end;
$$;

alter table public.items alter column category_id set not null;

create index items_category_id_idx on public.items (category_id);

-- Criado só depois do backfill (lê items.category_id).
create trigger categories_prevent_delete_non_empty
  before delete on public.categories
  for each row execute function public.categories_prevent_delete_non_empty();

-- 9. Triggers de items ------------------------------------------------------
-- Insert sem category_id (app antigo durante o deploy, import_trello_items,
-- complete_item_with_rating, onboarding) recebe a categoria do tipo.
-- Prefere a semeada (created_by null): uma categoria própria "Pubs"
-- (item_type activity) colocada antes de Programa não rouba esses itens.
create function public.items_fill_category()
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

create trigger items_fill_category
  before insert on public.items
  for each row execute function public.items_fill_category();

-- A categoria tem que ser do mesmo espaço do item (a RLS sozinha deixaria
-- apontar por id para a categoria de outro espaço).
-- Os triggers rodam em ordem alfabética: no insert este roda antes de
-- items_fill_category, então category_id null só passa (o fill escolhe uma
-- categoria do próprio espaço).
-- Não exige item.type = category.item_type: um restaurante movido para "Pubs"
-- continua restaurant (nota de 3 critérios).
create function public.items_category_same_space()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.category_id is not null and not exists (
    select 1 from public.categories c
    where c.id = new.category_id and c.space_id = new.space_id
  ) then
    raise exception 'category_other_space' using errcode = '23514';
  end if;

  return new;
end;
$$;

create trigger items_category_same_space
  before insert or update of category_id, space_id on public.items
  for each row execute function public.items_category_same_space();

-- 10. switch_space_and_redeem -----------------------------------------------
-- Mesmo corpo de 20261023120000_space_lifecycle.sql, mais: ao levar os itens,
-- cada categoria do espaço antigo vira a de mesmo name_key no espaço novo
-- (criada no fim da ordem se não existir) e os itens vão com o category_id
-- novo num update só. O delete do espaço antigo apaga as categorias antigas,
-- já vazias, pelo cascade.
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

-- 11. Preferência de visualização --------------------------------------------
-- profiles_update_self já deixa cada pessoa gravar só a sua.
alter table public.profiles
  add column item_view text not null default 'grid' check (item_view in ('grid','compact'));

-- 12. Grants ----------------------------------------------------------------
-- Funções internas e de trigger: ninguém chama direto (o Postgres não checa
-- EXECUTE ao disparar um trigger). O padrão do Supabase dá EXECUTE a
-- authenticated em funções novas, por isso o revoke explícito.
revoke execute on function public.category_name_key(text) from public, anon, authenticated;
revoke execute on function public.categories_normalize() from public, anon, authenticated;
revoke execute on function public.categories_enforce_limit() from public, anon, authenticated;
revoke execute on function public.categories_prevent_delete_non_empty() from public, anon, authenticated;
revoke execute on function public.seed_default_categories(uuid) from public, anon, authenticated;
revoke execute on function public.spaces_seed_categories() from public, anon, authenticated;
revoke execute on function public.items_fill_category() from public, anon, authenticated;
revoke execute on function public.items_category_same_space() from public, anon, authenticated;

commit;
