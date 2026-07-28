# Juntos (Couple Wishlist) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a private couple web app where two people share a wishlist (restaurants, food ideas, tourist spots, movies, cities), invite via one-time code, and rate completed items.

**Architecture:** Next.js App Router UI talks to Supabase Auth + Postgres. Row Level Security enforces space membership. Pure TypeScript helpers own rating math and invite code generation so they can be unit-tested without the database.

**Tech Stack:** Next.js 15 (App Router), TypeScript, Tailwind CSS, Supabase (`@supabase/ssr`, `@supabase/supabase-js`), Vitest, Vercel deploy.

## Global Constraints

- Spec: `docs/superpowers/specs/2026-07-28-couple-wishlist-design.md`
- Product name for UI copy: **Juntos**
- Space capacity: **2 members max**
- Invite: **one-time code**, expires in **7 days**, regenerating invalidates previous unused code
- Item types: `restaurant` | `food_idea` | `tourist_spot` | `movie` | `city`
- Status: `want` | `done`
- Restaurant rating: `food`, `service`, `ambiance` each 1–5; display average `(food+service+ambiance)/3` to 1 decimal
- Other types: single `score` 1–5
- One shared rating per item (any member create/update)
- Auth: email + password only
- No leave-space / delete-space in v1
- Mobile-first iPhone Safari; Portuguese UI copy
- Never commit Supabase service role key; only `NEXT_PUBLIC_SUPABASE_URL` + `NEXT_PUBLIC_SUPABASE_ANON_KEY` in client

## File Structure

```text
package.json
vitest.config.ts
.env.local.example
middleware.ts
app/layout.tsx
app/page.tsx                          # redirect by auth/space
app/login/page.tsx
app/signup/page.tsx
app/onboarding/page.tsx
app/(app)/layout.tsx                 # requires auth + space
app/(app)/page.tsx                   # home list
app/(app)/items/new/page.tsx
app/(app)/items/[id]/page.tsx
app/(app)/settings/page.tsx
app/auth/callback/route.ts
lib/types.ts
lib/ratings.ts
lib/invites.ts
lib/labels.ts
lib/supabase/client.ts
lib/supabase/server.ts
lib/supabase/middleware.ts
components/item-filters.tsx
components/item-list.tsx
components/item-form.tsx
components/rating-form.tsx
components/invite-panel.tsx
supabase/migrations/YYYYMMDDHHMMSS_init.sql
tests/ratings.test.ts
tests/invites.test.ts
README.md
```

---

### Task 1: Scaffold Next.js app + Vitest

**Files:**
- Create: project root via `create-next-app`
- Create: `vitest.config.ts`
- Create: `.env.local.example`
- Create: `README.md`

**Interfaces:**
- Consumes: none
- Produces: runnable Next.js app; `npm test` runs Vitest

- [ ] **Step 1: Create the Next.js app in the repo root**

Run from `/agent` (keep existing `docs/`):

```bash
npx create-next-app@latest . --typescript --tailwind --eslint --app --src-dir=false --import-alias="@/*" --turbopack --yes
```

If create-next-app refuses a non-empty directory, scaffold into `/tmp/juntos-scaffold`, then move app files into `/agent` preserving `docs/` and `.git`.

- [ ] **Step 2: Install dependencies**

```bash
npm install @supabase/supabase-js @supabase/ssr
npm install -D vitest @vitejs/plugin-react jsdom
```

- [ ] **Step 3: Add Vitest config and scripts**

Create `vitest.config.ts`:

```ts
import { defineConfig } from "vitest/config";
import path from "path";

export default defineConfig({
  test: {
    environment: "node",
    include: ["tests/**/*.test.ts"],
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "."),
    },
  },
});
```

In `package.json` scripts, add:

```json
"test": "vitest run",
"test:watch": "vitest"
```

- [ ] **Step 4: Add env example and README**

`.env.local.example`:

```bash
NEXT_PUBLIC_SUPABASE_URL=https://YOUR_PROJECT.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key
```

`README.md` should explain: copy env, create Supabase project, apply migration, `npm run dev`, open on phone via same LAN or Vercel.

- [ ] **Step 5: Verify scaffold**

```bash
npm test
npm run build
```

Expected: Vitest finds 0 tests (or exits 0); build succeeds.

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "chore: scaffold Next.js app with Vitest and Supabase deps"
```

---

### Task 2: Domain types + rating helpers (TDD)

**Files:**
- Create: `lib/types.ts`
- Create: `lib/ratings.ts`
- Create: `lib/labels.ts`
- Test: `tests/ratings.test.ts`

**Interfaces:**
- Consumes: none
- Produces:
  - `ItemType`, `ItemStatus`, `RestaurantRatingInput`, `SimpleRatingInput`
  - `restaurantAverage(food, service, ambiance): number`
  - `assertScore(n: number): void` throws if not integer 1..5
  - `TYPE_LABELS`, `STATUS_LABELS` in Portuguese

- [ ] **Step 1: Write failing tests**

Create `tests/ratings.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { assertScore, restaurantAverage } from "@/lib/ratings";

describe("restaurantAverage", () => {
  it("averages three scores to one decimal", () => {
    expect(restaurantAverage(5, 4, 4)).toBe(4.3);
    expect(restaurantAverage(5, 5, 5)).toBe(5);
    expect(restaurantAverage(1, 2, 3)).toBe(2);
  });
});

describe("assertScore", () => {
  it("accepts integers 1 through 5", () => {
    for (const n of [1, 2, 3, 4, 5]) {
      expect(() => assertScore(n)).not.toThrow();
    }
  });

  it("rejects out of range and non-integers", () => {
    expect(() => assertScore(0)).toThrow();
    expect(() => assertScore(6)).toThrow();
    expect(() => assertScore(3.5)).toThrow();
  });
});
```

- [ ] **Step 2: Run tests — expect FAIL**

```bash
npm test
```

Expected: FAIL — cannot find `@/lib/ratings` or exports.

- [ ] **Step 3: Implement types and helpers**

`lib/types.ts`:

```ts
export type ItemType =
  | "restaurant"
  | "food_idea"
  | "tourist_spot"
  | "movie"
  | "city";

export type ItemStatus = "want" | "done";

export type SpaceRole = "owner" | "member";

export type Item = {
  id: string;
  space_id: string;
  type: ItemType;
  title: string;
  url: string | null;
  notes: string | null;
  status: ItemStatus;
  created_by: string;
  completed_at: string | null;
  created_at: string;
  updated_at: string;
};

export type Rating = {
  id: string;
  item_id: string;
  rated_by: string;
  food: number | null;
  service: number | null;
  ambiance: number | null;
  score: number | null;
  created_at: string;
  updated_at: string;
};
```

`lib/ratings.ts`:

```ts
export function assertScore(n: number): void {
  if (!Number.isInteger(n) || n < 1 || n > 5) {
    throw new Error("Nota deve ser um inteiro de 1 a 5");
  }
}

export function restaurantAverage(
  food: number,
  service: number,
  ambiance: number,
): number {
  assertScore(food);
  assertScore(service);
  assertScore(ambiance);
  return Math.round(((food + service + ambiance) / 3) * 10) / 10;
}

export function displayRating(rating: {
  food: number | null;
  service: number | null;
  ambiance: number | null;
  score: number | null;
}): number | null {
  if (
    rating.food != null &&
    rating.service != null &&
    rating.ambiance != null
  ) {
    return restaurantAverage(rating.food, rating.service, rating.ambiance);
  }
  return rating.score;
}
```

`lib/labels.ts`:

```ts
import type { ItemStatus, ItemType } from "@/lib/types";

export const TYPE_LABELS: Record<ItemType, string> = {
  restaurant: "Restaurante",
  food_idea: "Ideia de comida",
  tourist_spot: "Ponto turístico",
  movie: "Filme",
  city: "Cidade",
};

export const STATUS_LABELS: Record<ItemStatus | "all", string> = {
  all: "Todos",
  want: "Queremos",
  done: "Já fizemos",
};
```

- [ ] **Step 4: Run tests — expect PASS**

```bash
npm test
```

Expected: all tests PASS.

- [ ] **Step 5: Commit**

```bash
git add lib/types.ts lib/ratings.ts lib/labels.ts tests/ratings.test.ts
git commit -m "feat: add domain types and rating helpers"
```

---

### Task 3: Invite code helpers (TDD)

**Files:**
- Create: `lib/invites.ts`
- Test: `tests/invites.test.ts`

**Interfaces:**
- Consumes: none
- Produces:
  - `generateInviteCode(): string` — 8 chars, uppercase A-Z excluding ambiguous `O`/`I`, digits excluding `0`/`1`
  - `inviteExpiresAt(from: Date = new Date()): Date` — `from + 7 days`
  - `isInviteExpired(expiresAt: Date | string, now: Date = new Date()): boolean`

- [ ] **Step 1: Write failing tests**

```ts
import { describe, expect, it } from "vitest";
import {
  generateInviteCode,
  inviteExpiresAt,
  isInviteExpired,
} from "@/lib/invites";

describe("generateInviteCode", () => {
  it("returns 8 chars from safe alphabet", () => {
    const code = generateInviteCode();
    expect(code).toHaveLength(8);
    expect(code).toMatch(/^[A-HJ-NP-Z2-9]{8}$/);
  });

  it("produces varied codes", () => {
    const set = new Set(Array.from({ length: 20 }, () => generateInviteCode()));
    expect(set.size).toBeGreaterThan(10);
  });
});

describe("invite expiry", () => {
  it("expires in 7 days", () => {
    const from = new Date("2026-07-28T12:00:00.000Z");
    const exp = inviteExpiresAt(from);
    expect(exp.toISOString()).toBe("2026-08-04T12:00:00.000Z");
  });

  it("detects expired invites", () => {
    expect(isInviteExpired("2026-07-01T00:00:00.000Z", new Date("2026-07-28"))).toBe(
      true,
    );
    expect(isInviteExpired("2026-08-01T00:00:00.000Z", new Date("2026-07-28"))).toBe(
      false,
    );
  });
});
```

- [ ] **Step 2: Run — expect FAIL**

```bash
npm test
```

- [ ] **Step 3: Implement `lib/invites.ts`**

```ts
const ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

export function generateInviteCode(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(8));
  return Array.from(bytes, (b) => ALPHABET[b % ALPHABET.length]).join("");
}

export function inviteExpiresAt(from: Date = new Date()): Date {
  return new Date(from.getTime() + 7 * 24 * 60 * 60 * 1000);
}

export function isInviteExpired(
  expiresAt: Date | string,
  now: Date = new Date(),
): boolean {
  return new Date(expiresAt).getTime() <= now.getTime();
}
```

Note: in Node Vitest, `crypto` is global in modern Node. If needed, `import { webcrypto as crypto } from "crypto"`.

- [ ] **Step 4: Run — expect PASS**

```bash
npm test
```

- [ ] **Step 5: Commit**

```bash
git add lib/invites.ts tests/invites.test.ts
git commit -m "feat: add invite code and expiry helpers"
```

---

### Task 4: Supabase schema + RLS migration

**Files:**
- Create: `supabase/migrations/<timestamp>_init.sql` via `supabase migration new init` when CLI is available; otherwise create `supabase/migrations/20260728000000_init.sql`

**Interfaces:**
- Consumes: data model from spec §9
- Produces: tables `profiles`, `spaces`, `space_members`, `invites`, `items`, `ratings` + RLS + RPCs `create_space_with_invite`, `redeem_invite`

- [ ] **Step 1: Write migration SQL**

```sql
-- profiles
create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  display_name text not null,
  created_at timestamptz not null default now()
);

create function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, display_name)
  values (
    new.id,
    coalesce(split_part(new.email, '@', 1), 'eu')
  );
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- spaces
create table public.spaces (
  id uuid primary key default gen_random_uuid(),
  name text not null default 'Nós dois',
  created_by uuid not null references auth.users (id),
  created_at timestamptz not null default now()
);

create table public.space_members (
  space_id uuid not null references public.spaces (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  role text not null check (role in ('owner', 'member')),
  joined_at timestamptz not null default now(),
  primary key (space_id, user_id)
);

create unique index space_members_user_unique on public.space_members (user_id);
-- v1: each user belongs to at most one space

create table public.invites (
  id uuid primary key default gen_random_uuid(),
  space_id uuid not null references public.spaces (id) on delete cascade,
  code text not null unique,
  created_by uuid not null references auth.users (id),
  expires_at timestamptz not null,
  redeemed_at timestamptz,
  redeemed_by uuid references auth.users (id),
  created_at timestamptz not null default now()
);

create table public.items (
  id uuid primary key default gen_random_uuid(),
  space_id uuid not null references public.spaces (id) on delete cascade,
  type text not null check (type in ('restaurant','food_idea','tourist_spot','movie','city')),
  title text not null check (char_length(trim(title)) > 0),
  url text,
  notes text,
  status text not null default 'want' check (status in ('want','done')),
  created_by uuid not null references auth.users (id),
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.ratings (
  id uuid primary key default gen_random_uuid(),
  item_id uuid not null unique references public.items (id) on delete cascade,
  rated_by uuid not null references auth.users (id),
  food int check (food between 1 and 5),
  service int check (service between 1 and 5),
  ambiance int check (ambiance between 1 and 5),
  score int check (score between 1 and 5),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint ratings_shape check (
    (food is not null and service is not null and ambiance is not null and score is null)
    or
    (score is not null and food is null and service is null and ambiance is null)
  )
);

-- helpers
create function public.is_space_member(p_space_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.space_members m
    where m.space_id = p_space_id and m.user_id = auth.uid()
  );
$$;

create function public.space_member_count(p_space_id uuid)
returns int
language sql
stable
security definer
set search_path = public
as $$
  select count(*)::int from public.space_members where space_id = p_space_id;
$$;

-- RLS
alter table public.profiles enable row level security;
alter table public.spaces enable row level security;
alter table public.space_members enable row level security;
alter table public.invites enable row level security;
alter table public.items enable row level security;
alter table public.ratings enable row level security;

create policy profiles_select_self on public.profiles
  for select using (id = auth.uid() or id in (
    select m2.user_id from public.space_members m1
    join public.space_members m2 on m1.space_id = m2.space_id
    where m1.user_id = auth.uid()
  ));

create policy profiles_update_self on public.profiles
  for update using (id = auth.uid());

create policy spaces_select_member on public.spaces
  for select using (public.is_space_member(id));

create policy space_members_select on public.space_members
  for select using (public.is_space_member(space_id));

create policy invites_select_member on public.invites
  for select using (public.is_space_member(space_id));

create policy items_all_member on public.items
  for all using (public.is_space_member(space_id))
  with check (public.is_space_member(space_id));

create policy ratings_all_member on public.ratings
  for all using (
    exists (
      select 1 from public.items i
      where i.id = item_id and public.is_space_member(i.space_id)
    )
  )
  with check (
    exists (
      select 1 from public.items i
      where i.id = item_id and public.is_space_member(i.space_id)
    )
  );

-- RPCs
create function public.create_space_with_invite(p_name text, p_code text, p_expires_at timestamptz)
returns table (space_id uuid, invite_code text)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_space_id uuid;
begin
  if auth.uid() is null then
    raise exception 'not_authenticated';
  end if;
  if exists (select 1 from public.space_members where user_id = auth.uid()) then
    raise exception 'already_in_space';
  end if;

  insert into public.spaces (name, created_by)
  values (coalesce(nullif(trim(p_name), ''), 'Nós dois'), auth.uid())
  returning id into v_space_id;

  insert into public.space_members (space_id, user_id, role)
  values (v_space_id, auth.uid(), 'owner');

  insert into public.invites (space_id, code, created_by, expires_at)
  values (v_space_id, upper(p_code), auth.uid(), p_expires_at);

  return query select v_space_id, upper(p_code);
end;
$$;

create function public.redeem_invite(p_code text)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_invite public.invites%rowtype;
  v_count int;
begin
  if auth.uid() is null then
    raise exception 'not_authenticated';
  end if;
  if exists (select 1 from public.space_members where user_id = auth.uid()) then
    raise exception 'already_in_space';
  end if;

  select * into v_invite
  from public.invites
  where code = upper(trim(p_code))
  for update;

  if not found then
    raise exception 'invalid_invite';
  end if;
  if v_invite.redeemed_at is not null then
    raise exception 'invite_used';
  end if;
  if v_invite.expires_at <= now() then
    raise exception 'invite_expired';
  end if;

  select count(*) into v_count from public.space_members where space_id = v_invite.space_id;
  if v_count >= 2 then
    raise exception 'space_full';
  end if;

  insert into public.space_members (space_id, user_id, role)
  values (v_invite.space_id, auth.uid(), 'member');

  update public.invites
  set redeemed_at = now(), redeemed_by = auth.uid()
  where id = v_invite.id;

  return v_invite.space_id;
end;
$$;

create function public.regenerate_invite(p_space_id uuid, p_code text, p_expires_at timestamptz)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_count int;
begin
  if not public.is_space_member(p_space_id) then
    raise exception 'forbidden';
  end if;
  select count(*) into v_count from public.space_members where space_id = p_space_id;
  if v_count >= 2 then
    raise exception 'space_full';
  end if;

  delete from public.invites
  where space_id = p_space_id and redeemed_at is null;

  insert into public.invites (space_id, code, created_by, expires_at)
  values (p_space_id, upper(p_code), auth.uid(), p_expires_at);

  return upper(p_code);
end;
$$;

grant execute on function public.create_space_with_invite(text, text, timestamptz) to authenticated;
grant execute on function public.redeem_invite(text) to authenticated;
grant execute on function public.regenerate_invite(uuid, text, timestamptz) to authenticated;
```

- [ ] **Step 2: Apply migration**

Prefer Supabase MCP `apply_migration` or Dashboard SQL editor with the file contents. Local alternative:

```bash
npx supabase db push
```

- [ ] **Step 3: Smoke-check tables exist**

Via MCP `list_tables` or SQL:

```sql
select table_name from information_schema.tables
where table_schema = 'public'
order by 1;
```

Expected: `profiles`, `spaces`, `space_members`, `invites`, `items`, `ratings`.

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations
git commit -m "feat: add Supabase schema, RLS, and invite RPCs"
```

---

### Task 5: Supabase browser/server clients + middleware

**Files:**
- Create: `lib/supabase/client.ts`
- Create: `lib/supabase/server.ts`
- Create: `lib/supabase/middleware.ts`
- Create: `middleware.ts`
- Create: `app/auth/callback/route.ts`

**Interfaces:**
- Consumes: env `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- Produces: `createClient()` (browser), `createClient()` (server), session refresh middleware

- [ ] **Step 1: Implement clients using `@supabase/ssr` patterns**

`lib/supabase/client.ts`:

```ts
import { createBrowserClient } from "@supabase/ssr";

export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  );
}
```

`lib/supabase/server.ts`:

```ts
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

export async function createClient() {
  const cookieStore = await cookies();
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options),
            );
          } catch {
            // Called from a Server Component; middleware refreshes sessions.
          }
        },
      },
    },
  );
}
```

`lib/supabase/middleware.ts` + root `middleware.ts`: refresh session; allow `/login`, `/signup`, `/auth/callback` without session; redirect unauthenticated users to `/login`; authenticated users hitting `/login` or `/signup` go to `/`.

`app/auth/callback/route.ts`: exchange code for session if using email confirm; redirect to `/`.

Before coding clients, confirm current `@supabase/ssr` cookie API via Supabase docs (`search_docs`) — signatures change; match the latest Next.js App Router guide.

- [ ] **Step 2: Set `.env.local` from example with real project keys**

- [ ] **Step 3: Manual smoke** — `npm run dev`, open `/login` (no crash)

- [ ] **Step 4: Commit**

```bash
git add lib/supabase middleware.ts app/auth
git commit -m "feat: add Supabase SSR clients and auth middleware"
```

---

### Task 6: Auth pages (signup / login)

**Files:**
- Create: `app/login/page.tsx`
- Create: `app/signup/page.tsx`
- Modify: `app/layout.tsx` (title “Juntos”, mobile viewport, base styles)
- Modify: `app/page.tsx` (server redirect logic)

**Interfaces:**
- Consumes: `createClient` from browser/server
- Produces: working email/password signup and login; `/` routes by state

- [ ] **Step 1: Implement signup page**

Client form: email, password (min 6), submit → `supabase.auth.signUp({ email, password })` → on success redirect `/onboarding`. Show Portuguese errors.

- [ ] **Step 2: Implement login page**

`signInWithPassword` → redirect `/`.

- [ ] **Step 3: Root `app/page.tsx` server logic**

```ts
// pseudocode
const supabase = await createClient();
const { data: { user } } = await supabase.auth.getUser();
if (!user) redirect("/login");
const { data: membership } = await supabase
  .from("space_members")
  .select("space_id")
  .eq("user_id", user.id)
  .maybeSingle();
if (!membership) redirect("/onboarding");
redirect("/home-or-app"); // after Task 7, app route group is `/` under (app)
```

During Task 6, keep a temporary authenticated landing that links to onboarding until `(app)` exists; Task 7 replaces with real home.

Actually: use route group from the start — create stub `app/(app)/page.tsx` that says “lista em breve” so redirects are stable:

- unauthenticated → `/login`
- authenticated, no space → `/onboarding`
- authenticated + space → `/(app)/` which is URL `/`

- [ ] **Step 4: Manual test**

1. Sign up user A  
2. Confirm email if Supabase project requires it (disable confirm in Auth settings for faster couple testing)  
3. Log out / log in  

- [ ] **Step 5: Commit**

```bash
git add app/login app/signup app/layout.tsx app/page.tsx app/\(app\)
git commit -m "feat: add email/password auth pages and routing gates"
```

---

### Task 7: Onboarding — create space or redeem invite

**Files:**
- Create: `app/onboarding/page.tsx`
- Create: `components/invite-panel.tsx` (also reused in settings)

**Interfaces:**
- Consumes: `generateInviteCode`, `inviteExpiresAt`, RPCs `create_space_with_invite`, `redeem_invite`
- Produces: user ends in a space; owner sees invite code to share

- [ ] **Step 1: Create space UI**

Button “Criar nosso espaço” calls:

```ts
const code = generateInviteCode();
const expires = inviteExpiresAt().toISOString();
const { data, error } = await supabase.rpc("create_space_with_invite", {
  p_name: "Nós dois",
  p_code: code,
  p_expires_at: expires,
});
```

Show the code + copyable link `https://<host>/onboarding?code=XXXX` and “Ir para a lista”.

- [ ] **Step 2: Redeem UI**

Input for code (prefill from `?code=`). Submit:

```ts
const { error } = await supabase.rpc("redeem_invite", { p_code: code });
```

Map Postgres exceptions to Portuguese:

| exception | message |
|-----------|---------|
| `invalid_invite` | Convite inválido |
| `invite_used` | Este convite já foi usado |
| `invite_expired` | Este convite expirou |
| `space_full` | Este espaço já tem 2 pessoas |
| `already_in_space` | Você já está em um espaço |

- [ ] **Step 3: Guard** — if user already in a space, redirect `/`

- [ ] **Step 4: Manual test with two browsers/profiles**

1. User A creates space, copies code  
2. User B redeems  
3. User C with new code after full → `space_full`  
4. Reuse same code → `invite_used`

- [ ] **Step 5: Commit**

```bash
git add app/onboarding components/invite-panel.tsx
git commit -m "feat: add couple space onboarding and invite redeem"
```

---

### Task 8: Home list + filters

**Files:**
- Create: `components/item-filters.tsx`
- Create: `components/item-list.tsx`
- Modify: `app/(app)/layout.tsx` (nav: Lista, +, Config)
- Modify: `app/(app)/page.tsx`

**Interfaces:**
- Consumes: `items` + left join/select `ratings`, `TYPE_LABELS`, `STATUS_LABELS`, `displayRating`
- Produces: filterable list; empty state “Nenhuma ideia ainda”

- [ ] **Step 1: `(app)/layout.tsx`**

Server: require user + membership; provide simple top nav links `/`, `/items/new`, `/settings`.

- [ ] **Step 2: Filters component**

Controlled props:

```ts
type Props = {
  type: ItemType | "all";
  status: ItemStatus | "all";
  onTypeChange: (t: ItemType | "all") => void;
  onStatusChange: (s: ItemStatus | "all") => void;
};
```

Use native `<select>` or segmented buttons — no card chrome.

- [ ] **Step 3: List query (server or client)**

```ts
const { data } = await supabase
  .from("items")
  .select("*, ratings(*)")
  .eq("space_id", spaceId)
  .order("created_at", { ascending: false });
```

Apply type/status filters in query params (`?type=&status=`) so links are shareable between the couple’s phones.

- [ ] **Step 4: Row UI**

Show title, type label, status, and `displayRating` when present. Link to `/items/[id]`.

- [ ] **Step 5: Manual test** — empty list, then seed later in Task 9

- [ ] **Step 6: Commit**

```bash
git add app/\(app\) components/item-filters.tsx components/item-list.tsx
git commit -m "feat: add home wishlist with type and status filters"
```

---

### Task 9: Create / edit item

**Files:**
- Create: `components/item-form.tsx`
- Create: `app/(app)/items/new/page.tsx`
- Modify: `app/(app)/items/[id]/page.tsx` (edit section; detail completed in Task 10)

**Interfaces:**
- Consumes: `ItemType`, supabase `items` insert/update
- Produces: create item with `status='want'`; edit title/url/notes/type while `want` (type locked after `done` optional — lock type always after create to keep ratings shape simple: **type immutable after create**)

- [ ] **Step 1: `ItemForm`**

Fields: type (select, required on create only), title (required), url (optional), notes (optional textarea). Validate title non-empty trim. Do not validate URL format beyond optional string.

- [ ] **Step 2: New item page**

Insert:

```ts
await supabase.from("items").insert({
  space_id,
  type,
  title: title.trim(),
  url: url.trim() || null,
  notes: notes.trim() || null,
  status: "want",
  created_by: user.id,
});
```

Redirect to `/`.

- [ ] **Step 3: Manual test** — create one of each type; appear under Queremos

- [ ] **Step 4: Commit**

```bash
git add components/item-form.tsx app/\(app\)/items
git commit -m "feat: add create item form for all five types"
```

---

### Task 10: Item detail — mark done + ratings

**Files:**
- Create: `components/rating-form.tsx`
- Modify: `app/(app)/items/[id]/page.tsx`

**Interfaces:**
- Consumes: `assertScore`, `restaurantAverage`, `displayRating`
- Produces: mark done + upsert shared rating; edit rating later

- [ ] **Step 1: Detail page loads item + rating for members only**

If not found / RLS hides → `notFound()`.

- [ ] **Step 2: `RatingForm`**

If `item.type === "restaurant"`: three number inputs/selects 1–5 (Comida, Atendimento, Ambiente).  
Else: one select 1–5 (Nota).  
On submit:

1. Client-side `assertScore` on each value  
2. Update item: `status='done'`, `completed_at=now()` if still `want`  
3. Upsert rating:

```ts
// restaurant
{ item_id, rated_by: user.id, food, service, ambiance, score: null }
// other
{ item_id, rated_by: user.id, score, food: null, service: null, ambiance: null }
```

Use `.upsert(..., { onConflict: "item_id" })`.

- [ ] **Step 3: Show average / score on detail and allow “Editar nota”**

- [ ] **Step 4: Unit test already covers averages — add one UI-level manual script**

Manual: restaurant 5/4/4 → shows 4.3; movie score 4 → shows 4; partner opens same item and edits score.

- [ ] **Step 5: Commit**

```bash
git add components/rating-form.tsx app/\(app\)/items
git commit -m "feat: mark items done and save shared ratings"
```

---

### Task 11: Settings — invite regenerate + logout

**Files:**
- Create: `app/(app)/settings/page.tsx`
- Reuse: `components/invite-panel.tsx`

**Interfaces:**
- Consumes: `regenerate_invite` RPC, `generateInviteCode`, `inviteExpiresAt`, member count
- Produces: show invite only if member count < 2; logout button

- [ ] **Step 1: Settings page**

Show space name, both display names (from profiles join), logout via `supabase.auth.signOut()` → `/login`.

- [ ] **Step 2: Invite panel**

If `space_member_count < 2`: show active unused invite code if any; button “Gerar novo convite” → `regenerate_invite`.  
If count === 2: text “Vocês dois já estão no espaço.”

- [ ] **Step 3: Manual test regenerate invalidates old code**

- [ ] **Step 4: Commit**

```bash
git add app/\(app\)/settings components/invite-panel.tsx
git commit -m "feat: add settings with invite regenerate and logout"
```

---

### Task 12: Polish UI + deploy checklist

**Files:**
- Modify: global CSS / layout typography (expressive font via `next/font` — not Inter; e.g. `Fraunces` + `Source_Sans_3`)
- Modify: `README.md` with couple testing script
- Modify: spec status line optional

**Interfaces:**
- Consumes: all prior UI
- Produces: usable mobile UI on iPhone Safari; deploy notes

- [ ] **Step 1: Mobile layout pass**

- Comfortable tap targets  
- Sticky “+” or clear nav  
- Soft atmospheric background (subtle gradient), not flat white only  
- Avoid purple-gradient AI cliché; pick a warm-night or soft sage direction via CSS variables  

- [ ] **Step 2: End-to-end couple script in README**

1. Create two accounts  
2. A creates space, shares code  
3. B joins  
4. Add Instagram paste restaurant  
5. Mark done with 3 scores  
6. Filter Já fizemos  

- [ ] **Step 3: `npm test && npm run build`**

Expected: all unit tests pass; production build succeeds.

- [ ] **Step 4: Deploy to Vercel** (when user provides/links project) and set env vars

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat: polish mobile UI and document couple test script"
```

---

## Spec coverage checklist

| Spec requirement | Task |
|------------------|------|
| Email/password auth | 6 |
| Create space + invite | 7 |
| Redeem invite + errors | 7 |
| 5 item types | 9 |
| Paste link optional | 9 |
| Filters type/status | 8 |
| Restaurant 3 scores + average | 2, 10 |
| Simple score other types | 10 |
| Shared one rating / item | 10 |
| Max 2 members + regenerate once | 4, 7, 11 |
| Regenerable invite | 11 |
| RLS member-only | 4 |
| Settings logout | 11 |
| No leave-space v1 | 11 (omitted) |
| Web first | all |
| Unit tests ratings | 2 |
| Manual iPhone path | 12 |

## Placeholder / consistency self-review

- Fixed product name **Juntos** for copy  
- RPC names consistent: `create_space_with_invite`, `redeem_invite`, `regenerate_invite`  
- Rating shape constraint matches UI branches  
- `space_members_user_unique` enforces one space per user in v1 (matches onboarding redirects)

---

## Execution handoff

Plan complete and saved to `docs/superpowers/plans/2026-07-28-couple-wishlist.md`.

**Two execution options:**

1. **Subagent-Driven (recommended)** — fresh subagent per task, review between tasks  
2. **Inline Execution** — run tasks in this session with executing-plans and checkpoints  

Which approach?
