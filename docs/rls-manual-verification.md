# RLS manual verification checklist

Use a live Supabase project with the migrations applied. Run these with two test
accounts in the same couple space and a third account outside it.

1. **Member can read shared space data**
   - Sign in as account A, create a space, and add an item.
   - Sign in as account B using A's invite.
   - Confirm B can read the shared `spaces`, `space_members`, `items`, and
     `ratings` rows for that space.

2. **Non-member cannot read or mutate another space**
   - Sign in as account C without joining A/B's space.
   - Confirm C gets no rows for A/B's `spaces`, `space_members`, `invites`,
     `items`, and `ratings`.
   - Confirm C cannot insert, update, or delete items or ratings using A/B's
     `space_id` or item IDs.

3. **Third person cannot join a full space**
   - With A and B already in the same space, sign in as account C.
   - Attempt `redeem_invite` with the original invite code or a regenerated
     invite code for that space.
   - Confirm the RPC rejects the request and C has no `space_members` row for
     the full space.

4. **Autoria (updated_by)**
   - Sign in as account A and create an item; confirm `created_by` and
     `updated_by` are both A.
   - Sign in as account B and edit A's item title. Confirm `updated_by` is B,
     `updated_at` was refreshed, and `created_by` is still A.
   - As B, run `update items set created_by = <outro>` through the API and
     confirm it fails with `created_by_immutable`.
   - As B, send an update with `updated_by = <outro>` and confirm the stored
     `updated_by` is overwritten with B (`auth.uid()`).
   - Repeat the `created_by` update against `spaces` and confirm the same
     `created_by_immutable` error; a rename sets `spaces.updated_by` to the
     authenticated user.
   - Rename a space and confirm `spaces.updated_at` is refreshed to now.
   - As B, send an update that changes nothing (e.g. `title = title` with
     `updated_by = <outro>`) and confirm `updated_by`/`updated_at` are kept.
   - As A, rate a "Quero ir" item created by B (the first rating moves it to
     "Já fomos") and confirm `updated_by` is A.
   - As B, re-rate an item that is already "Já fomos" and confirm the item's
     `updated_by`/`updated_at` are unchanged (only the rating row changes).
   - As B, move an item to a space B is not a member of and confirm it fails
     with a row-level security violation; the item stays in its space.
