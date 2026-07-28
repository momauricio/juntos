# Juntos

A couple wishlist app — share gift ideas and keep them in sync.

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

### Testing on your phone

- **Same Wi‑Fi (LAN):** Find your machine's local IP (e.g. `192.168.1.10`) and open `http://<your-ip>:3000` on your phone while `npm run dev` is running.
- **Vercel:** Deploy the app and open the production URL on any device.

## Scripts

| Command        | Description              |
| -------------- | ------------------------ |
| `npm run dev`  | Start dev server         |
| `npm run build`| Production build         |
| `npm test`     | Run Vitest once          |
| `npm run test:watch` | Run Vitest in watch mode |
