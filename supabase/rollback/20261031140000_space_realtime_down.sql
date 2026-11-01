-- ATENÇÃO: desfaz supabase/migrations/20261031140000_space_realtime.sql.
-- Só roda com OK do Mauricio. Fica fora de migrations/ de propósito.
-- Não apaga dado: só tira os triggers de broadcast, a política em
-- realtime.messages e as três funções. O app continua funcionando; só deixa
-- de atualizar na hora (volta a atualizar ao navegar ou ao voltar o foco).
-- Para desfazer as categorias também: rode este arquivo ANTES dos rollbacks
-- de 20261031134500, de 20261031133000, de 20261031130000 e de categories.

begin;

drop trigger if exists items_broadcast_changes on public.items;
drop trigger if exists categories_broadcast_changes on public.categories;
drop trigger if exists ratings_broadcast_changes on public.ratings;

drop policy if exists space_members_receive_broadcast on realtime.messages;

drop function if exists public.broadcast_space_change();
drop function if exists public.broadcast_rating_change();
drop function if exists public.space_id_from_topic(text);

commit;
