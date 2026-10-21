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

4. **Ratings use the 1–10 scale**
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
