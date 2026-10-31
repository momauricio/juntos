-- ATENÇÃO: desfaz supabase/migrations/20261031150000_items_city.sql.
-- PERDE TODAS AS CIDADES GRAVADAS em items.city (a coluna é apagada; nada vai
-- para backup). Se precisar guardar antes:
--   create table backup.items_city_<data> as
--     select id, city from public.items where city is not null;
-- Só roda com OK do Mauricio. Fica fora de migrations/ de propósito.
-- O app com o campo "Cidade (opcional)" para de salvar depois disto: volte o
-- app para a versão sem cidade antes (ou junto).

begin;

alter table public.items drop constraint if exists items_city_check;
alter table public.items drop column if exists city;

commit;
