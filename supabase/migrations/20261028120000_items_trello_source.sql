-- Origem dos itens (importação do Trello) + tipo novo 'stay' (Hospedagem).
-- Base: spec-importar-trello.md §7 + coluna metadata
-- para não perder nada do Trello que não tem campo no Juntos.
-- Guarda: origem do item, id do card (idempotência), data do card no Trello e
-- um jsonb com tudo que sobra (lista/quadro de origem, etiquetas, nota do casal
-- detalhada, comentários com autor e data, anexos/imagens, capa, membros,
-- histórico de movimentação, renomeações, desc original).

-- Tipo novo: Hospedagem (hotel, motel, cabana, pousada).
alter table public.items
  drop constraint if exists items_type_check;

alter table public.items
  add constraint items_type_check
  check (type in ('restaurant','food_idea','tourist_spot','movie','city','event','activity','stay'));

alter table public.items
  add column source text check (source in ('trello')),
  add column source_ref text check (char_length(source_ref) between 1 and 64),
  add column source_created_at timestamptz,
  add column metadata jsonb not null default '{}'::jsonb,
  add constraint items_source_pair check ((source is null) = (source_ref is null)),
  add constraint items_metadata_object check (jsonb_typeof(metadata) = 'object');

create unique index items_source_ref_unique
  on public.items (space_id, source, source_ref)
  where source_ref is not null;

-- RPC do app (PR10a), estendida com metadata. security invoker: vale a RLS.
create or replace function public.import_trello_items(p_items jsonb)
returns table (inserted int, skipped int)
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_space uuid;
  v_total int;
  v_ins int;
begin
  if auth.uid() is null then raise exception 'not_authenticated'; end if;
  select space_id into v_space from public.space_members where user_id = auth.uid();
  if v_space is null then raise exception 'no_space'; end if;
  if jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) > 200 then
    raise exception 'invalid_import_batch' using errcode = '22023';
  end if;
  v_total := jsonb_array_length(p_items);

  if exists (
    select 1 from jsonb_array_elements(p_items) e
    where not (
      e->>'type' in ('restaurant','food_idea','tourist_spot','movie','city','event','activity','stay')
      and e->>'status' in ('want','done')
      and char_length(trim(coalesce(e->>'title',''))) between 1 and 200
      and (e->>'url' is null or e->>'url' ~ '^https?://')
      and char_length(coalesce(e->>'notes','')) <= 4000
      and char_length(coalesce(e->>'source_ref','')) between 1 and 64
      and (e->'metadata' is null or jsonb_typeof(e->'metadata') = 'object')
    )
  ) then
    raise exception 'invalid_import_item' using errcode = '23514';
  end if;

  insert into public.items (space_id, type, title, url, notes, status, completed_at,
                            created_at, source, source_ref, source_created_at, metadata)
  select v_space, e->>'type', trim(e->>'title'), e->>'url', nullif(e->>'notes',''), e->>'status',
         (e->>'completed_at')::timestamptz, now() - (o * interval '1 millisecond'),
         'trello', e->>'source_ref', (e->>'source_created_at')::timestamptz,
         coalesce(e->'metadata', '{}'::jsonb)
  from jsonb_array_elements(p_items) with ordinality as t(e, o)
  on conflict (space_id, source, source_ref) where source_ref is not null do nothing;

  get diagnostics v_ins = row_count;
  return query select v_ins, v_total - v_ins;
end;
$$;

revoke execute on function public.import_trello_items(jsonb) from public, anon;
grant execute on function public.import_trello_items(jsonb) to authenticated;

