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
