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

4. **Invite preview is public but minimal (PR6)**
   - Signed out, open `/c/<code>` for A's space (or call
     `invite_preview('<code>')` with the anon key).
   - Confirm the payload has only `status`, `host_first_name`, `item_count`,
     `thumbnails` (item types) and `is_member`: no titles, e-mails or ids.
   - Confirm `item_count` counts only items in **Quero ir** and `thumbnails`
     has at most 3 entries.
   - Confirm a used code shows "Esse convite já foi usado…", a code with
     `expires_at` in the past shows the expired text, an unknown code shows
     "Não achamos esse convite…" and a space with 2 people shows the full text.
   - With the anon key, confirm `create_space_with_invite`,
     `regenerate_invite`, `rename_space`, `leave_space` and
     `switch_space_and_redeem` fail with permission denied.

5. **Rename and leave (PR6)**
   - As A and then as B, call `rename_space` and confirm both see the new name
     after reloading; an empty name shows "{A} & {B}" again.
   - As C (outside), confirm `rename_space` fails with `forbidden` and A/B's
     `spaces.name` is unchanged.
   - As A, `leave_space()` returns `left`: B keeps every item and becomes
     `owner`; A lands on `/onboarding/nome` with no space and B sees
     "Esperando seu par entrar".
   - As B (now alone), `leave_space()` returns `deleted`: the space, its items,
     ratings and invites are gone.

6. **Switching spaces (PR6)**
   - D alone with 2 items opens E's invite and picks "Trazer e entrar": E's
     space now has D's items (same `created_by`, ratings kept) and D's old
     space no longer exists.
   - Same with "Entrar sem trazer (apaga o meu)": D's old items are deleted.
   - B, already with A, opens another invite: "Você já está num espaço com
     A…" and `switch_space_and_redeem` fails with `space_has_partner` without
     changing anything.
   - A opening A's own link sees "Esse convite é seu 😉".
