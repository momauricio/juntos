# Task 4 Report: Supabase schema + RLS migration

## Status

DONE_WITH_CONCERNS

## Commit

Created commit:

```text
29eb2a1 feat: add Supabase schema, RLS, and invite RPCs
```

Push was attempted with `git push`, but this checkout has no configured remote/push destination.

## Summary

Created Supabase local project scaffolding and the initial migration:

- `supabase/config.toml`
- `supabase/.gitignore`
- `supabase/migrations/20260728015342_init.sql`

The migration includes the SQL from the brief for:

- Tables: `profiles`, `spaces`, `space_members`, `invites`, `items`, `ratings`
- RLS enablement and policies for those tables
- Helper functions: `handle_new_user`, `is_space_member`, `space_member_count`
- RPCs: `create_space_with_invite`, `redeem_invite`, `regenerate_invite`
- Execute grants for authenticated users on the RPCs

Per task constraints, I did not create a new remote Supabase project and did not apply anything to the existing remote projects `financas-pro` or `momauricio's Project`.

## Commands run

```bash
npx supabase --version
npx supabase init --yes
npx supabase migration new init
docker --version && docker info --format '{{.ServerVersion}}'
git diff --check && npm test
git add supabase
git -c user.email="agent@cursor.com" -c user.name="Cursor Agent" commit -m "feat: add Supabase schema, RLS, and invite RPCs"
git push
```

## Verification

Passed:

- Supabase CLI available: `2.110.0`
- Migration file created via `npx supabase migration new init`
- Static migration content check found all expected tables and RPCs
- `git diff --check`
- `npm test`:
  - 2 test files passed
  - 7 tests passed

Deferred:

- Local Supabase apply/smoke via `npx supabase start` was not run because Docker is unavailable in this environment:

```text
docker: command not found
```

## Concerns

1. Database migration has not been applied to a live local or remote database in this run.
2. Table existence smoke query is deferred until Docker/local Supabase or an approved remote Supabase project is available.
3. Commit push is deferred because the repository has no configured Git remote.

## Next recommended smoke

When Docker is available:

```bash
npx supabase start
npx supabase db reset
npx supabase db diff --local
```

Then verify:

```sql
select table_name
from information_schema.tables
where table_schema = 'public'
order by 1;
```

Expected: `profiles`, `spaces`, `space_members`, `invites`, `items`, `ratings`.

## Review fixes applied

- Added `items_force_created_by` trigger to force `items.created_by = auth.uid()` on insert.
- Added `ratings_enforce_identity_and_shape` trigger to force `ratings.rated_by = auth.uid()` on insert/update and validate rating fields against the joined `items.type`.
- Added `items_prevent_type_change` trigger to keep item types immutable after insert.
- Kept invite RPC signatures compatible while storing invite expiry as `now() + interval '7 days'` in `create_space_with_invite` and `regenerate_invite`.

## Review fix verification

Passed:

- `npm test`
- `git diff --check`
