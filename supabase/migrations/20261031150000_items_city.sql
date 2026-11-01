-- Cidade do item (spec-layout-categorias.md §7, PR 3).
-- items.city: opcional, de 1 a 60 caracteres e sem espaço nas pontas (o app
-- faz trim e grava null quando vazio). Só adiciona a coluna, nula em todos os
-- itens: nenhum dado muda e não há backfill (as cidades que hoje estão no
-- título do Trello só mudam com o script de prévia + OK do Mauricio).
-- Volta: supabase/rollback/20261031150000_items_city_down.sql (só com OK do Mauricio).

begin;

alter table public.items
  add column city text null;

alter table public.items
  add constraint items_city_check
  check (city is null or (city = btrim(city) and char_length(city) between 1 and 60));

commit;
