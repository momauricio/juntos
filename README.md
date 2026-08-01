# Juntos

Wishlist compartilhada do casal — restaurantes, filmes, viagens e ideias, com notas depois de viver.

## Modo demo (teste mobile agora)

Site público de teste (mobile-first):

**https://momauricio.github.io/juntos/**

Sem projeto Supabase extra, o app sobe em **modo demo**:

- Dados ficam no aparelho (`localStorage`)
- Aba **Lista** para ideias (restaurantes, filmes, etc.)
- Aba **Viagens** para checklist + roteiro por dia + documentos (links)
- Aba **Sync** gera um link para mandar no WhatsApp
- A outra pessoa abre o link, entra com o nome e vê lista **e** viagens
- Quando ela adicionar algo, manda o Sync de volta para mesclar

### Fluxo rápido de viagem

1. Abra **Viagens** → **+ Nova** (ex.: Chile 2026)
2. Em **Checklist**, marque o que levar
3. Em **Roteiro**, adicione paradas por dia
4. Em **Docs**, cole links de passagem, reserva, entrada ou seguro
5. Em **Sync**, compartilhe o link com a parceira

```bash
# .env.local
NEXT_PUBLIC_DEMO_MODE=true
```

Build estático para GitHub Pages:

```bash
npm run build:demo-static
```

## Setup completo (Supabase)

### 1. Environment variables

```bash
cp .env.local.example .env.local
```

Defina `NEXT_PUBLIC_DEMO_MODE=false` e preencha URL + anon key do Supabase.

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

1. Create account A and account B (or use demo names).
2. Sign in as A, create a space, and share the Sync link.
3. Sign in as B and join/merge with that link.
4. Add a restaurant idea from an Instagram paste or URL.
5. Open the item, mark it done, and save the 3 restaurant scores.
6. Filter the list by **Já fizemos** and confirm the completed item appears.
7. Create a trip under **Viagens**, add checklist + day stops + document links, Sync again.

For couple testing with Supabase Auth, email confirmation is easiest with **Confirm email** disabled in the Supabase dashboard.

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
