-- Desfaz supabase/migrations/20261110220000_items_space_created_idx.sql.
-- Só remove o índice: nenhum dado se perde.

begin;

drop index if exists public.items_space_created_idx;

commit;
