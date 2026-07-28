# Juntos

A couple ideas app — share restaurants, films, trips, and plans, and keep them in sync.

## Setup

### 1. Environment variables

Copy the example env file and fill in your Supabase credentials:

```bash
cp .env.local.example .env.local
```

### 2. Supabase project

1. Create a project at [supabase.com](https://supabase.com).
2. In **Project Settings → API**, copy the project URL and anon (public) key into `.env.local`.

### 3. Database migration

Apply the project migration to your Supabase database (see `docs/` for schema details):

```bash
# Using the Supabase CLI (after linking your project):
supabase db push
```

Or run the SQL migration manually in the Supabase SQL editor.

## Development

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

### Couple testing script

For a quick end-to-end check with two people or two browser profiles:

1. Create account A and account B.
2. Sign in as A, create a space, and share the invite code or link.
3. Sign in as B and join the space with that invite.
4. Add a restaurant idea from an Instagram paste or URL.
5. Open the item, mark it done, and save the 3 restaurant scores.
6. Filter the list by **Já fizemos** and confirm the completed item appears.

For couple testing, Supabase Auth email confirmation is easiest with **Confirm email** disabled in the Supabase dashboard.

### Testing on your phone

- **Same Wi‑Fi (LAN):** Find your machine's local IP (e.g. `192.168.1.10`) and open `http://<your-ip>:3000` on your phone while `npm run dev` is running.
- **Vercel:** Deploy the app and open the production URL on any device.

## Deploy checklist

1. Apply the Supabase migration before first deploy:

   ```bash
   supabase db push
   ```

   Or run `supabase/migrations/20260728015342_init.sql` in the Supabase SQL editor.

2. In Vercel, set the production environment variables:

   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`

3. Deploy the Next.js app to Vercel.
4. Run the couple testing script against the production URL on iPhone Safari.
5. For manual couple testing, keep Supabase Auth email confirmation disabled if you want both accounts usable immediately.

## Scripts

| Command        | Description              |
| -------------- | ------------------------ |
| `npm run dev`  | Start dev server         |
| `npm run build`| Production build         |
| `npm test`     | Run Vitest once          |
| `npm run test:watch` | Run Vitest in watch mode |
