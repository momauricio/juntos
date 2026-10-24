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

4. **Space member limit is enforced by the database**
   - With A and B already in the same space, open the SQL editor as `postgres`
     (which bypasses RLS) and insert a third `space_members` row for that space.
   - Confirm the insert fails with `space_full`.
   - Create a space with only one member and an open invite. Sign in as
     accounts C and D and call `redeem_invite` concurrently with that code.
   - Confirm only one call succeeds, the other gets `space_full`, and the space
     ends up with exactly two `space_members` rows.

5. **Functions are not executable by anon**
   - Using only the anon key and no session, call `rpc('redeem_invite')`,
     `rpc('create_space_with_invite')`, `rpc('regenerate_invite')`,
     `rpc('complete_item_with_rating')`, and `rpc('is_space_member')`.
   - Confirm each returns `permission denied for function ...`.
   - Confirm signed-in users can still call them.
   - As `postgres` (the role that runs migrations), create a new function in
     `public` after the migration and confirm anon calling it gets
     `permission denied for function ...`.
   - Note: anon reading a table whose policy uses `is_space_member` now gets
     `permission denied for function is_space_member` instead of empty rows.
     This is expected; the app only queries those tables with a session.

6. **Smoke test after the grants change**
   - Sign in as A and create a space.
   - Copy the invite and sign in as B to accept it.
   - Create an item and rate it.
   - Confirm every step succeeds without permission errors.

7. **Autoria (updated_by)**
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

8. **Ratings use the 1–10 scale**
   - Apply `20261020120000_ratings_scale_1_10.sql` and sign in as account A.
   - Call `complete_item_with_rating` on a non-restaurant item with
     `p_score = 10`. Confirm it saves and the item is marked done.
   - Call it with `p_score = 0` and with `p_score = 11`. Confirm both raise
     `standard_rating_shape`.
   - Call it on a restaurant item with `p_food = 9`, `p_service = 10`,
     `p_ambiance = 6`. Confirm it saves and the item list shows "Nota 8,3".
   - Call it on a restaurant item with `p_food = 11`. Confirm it raises
     `restaurant_rating_shape`.
   - Directly insert or update a `ratings` row with `food`, `service`,
     `ambiance`, or `score` set to 11. Confirm it violates the matching
     `ratings_*_check` constraint.
   - Confirm pre-existing ratings with values 1–5 are unchanged and still valid.
