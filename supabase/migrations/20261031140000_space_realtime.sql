-- Realtime do espaço (spec-layout-categorias.md §8, regra C9).
--
-- Os dois do casal veem na hora itens e categorias criados, editados,
-- movidos (inclusive reordenados) ou apagados pelo outro, e as notas
-- (public.ratings). Cada mudança em public.items, public.categories e
-- public.ratings vira uma mensagem Broadcast no canal
-- privado "space:{space_id}"; o cliente (components/space-live.tsx) só
-- escuta e faz router.refresh().
--
-- Por que NÃO entra na publicação supabase_realtime: realtime.broadcast_changes
-- grava direto em realtime.messages, que o serviço Realtime já replica por
-- conta própria. A publicação supabase_realtime só serve para Postgres
-- Changes, que este app não usa. Adicionar items/categories nela só faria o
-- Realtime processar cada mudança duas vezes, sem ninguém escutando.
--
-- Quem lê: só membro do espaço do tópico (política em realtime.messages).
-- Ninguém escreve pelo cliente: não há política de insert.
-- No painel (Mauricio): Realtime -> desligar "Allow public access", para só
-- canais privados funcionarem.
-- Rollback: supabase/rollback/20261031140000_space_realtime_down.sql.

begin;

-- 1. Trigger: cada linha mudada vira uma mensagem no tópico do espaço --------
create or replace function public.broadcast_space_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  -- No INSERT old é null, no DELETE new é null (como no exemplo do Supabase:
  -- broadcast_changes recebe os dois e põe record/old_record no payload).
  -- Num UPDATE que muda space_id, a mensagem vai para o espaço novo.
  perform realtime.broadcast_changes(
    'space:' || coalesce(new.space_id, old.space_id)::text,
    tg_op,
    tg_op,
    tg_table_name,
    tg_table_schema,
    new,
    old
  );
  -- after trigger: o retorno é ignorado
  return coalesce(new, old);
end;
$$;

revoke execute on function public.broadcast_space_change() from public, anon, authenticated;

create trigger items_broadcast_changes
  after insert or update or delete on public.items
  for each row execute function public.broadcast_space_change();

create trigger categories_broadcast_changes
  after insert or update or delete on public.categories
  for each row execute function public.broadcast_space_change();

-- 2. Notas: ratings não tem space_id; o espaço vem do item ----------------
-- Função própria (e não a genérica com um if por tabela): a genérica fica
-- trivial e sem consulta, e só esta precisa ler public.items. Se o item já
-- não existe (a nota está sendo apagada em cascata pelo delete do item), não
-- manda nada: o delete do item já avisou o espaço. Nunca levanta erro por
-- falta do item.
create or replace function public.broadcast_rating_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_space_id uuid;
begin
  select i.space_id into v_space_id
  from public.items i
  where i.id = coalesce(new.item_id, old.item_id);

  if v_space_id is not null then
    perform realtime.broadcast_changes(
      'space:' || v_space_id::text,
      tg_op,
      tg_op,
      tg_table_name,
      tg_table_schema,
      new,
      old
    );
  end if;
  return coalesce(new, old);
end;
$$;

revoke execute on function public.broadcast_rating_change() from public, anon, authenticated;

create trigger ratings_broadcast_changes
  after insert or update or delete on public.ratings
  for each row execute function public.broadcast_rating_change();

-- 3. Tópico -> space_id, sem erro para tópico inválido ----------------------
create or replace function public.space_id_from_topic(p_topic text)
returns uuid
language sql
immutable
set search_path = public
as $$
  select case
    when p_topic ~ '^space:[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$'
      then substr(p_topic, 7)::uuid
  end;
$$;

revoke execute on function public.space_id_from_topic(text) from public, anon;
grant execute on function public.space_id_from_topic(text) to authenticated;

-- 4. Quem recebe: só membro do espaço do tópico ------------------------------
-- is_space_member(null) = false, então tópico inválido não recebe nada.
create policy space_members_receive_broadcast on realtime.messages
  for select
  to authenticated
  using (
    realtime.messages.extension = 'broadcast'
    and public.is_space_member(public.space_id_from_topic(realtime.topic()))
  );

commit;
