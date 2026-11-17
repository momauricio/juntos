-- Índice de performance: a lista inicial (/) e /recentes filtram items por
-- space_id e ordenam por created_at desc. Sem índice, isso é full scan da
-- tabela a cada carregamento (a RLS de items_all_member soma is_space_member()
-- por linha varrida). Só adiciona índice: nenhum dado muda.
-- Volta: supabase/rollback/20261110220000_items_space_created_idx_down.sql.

begin;

create index if not exists items_space_created_idx
  on public.items (space_id, created_at desc);

commit;
