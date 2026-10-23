# Juntos

Wishlist compartilhada do casal — restaurantes, filmes, viagens e ideias, com notas depois de viver.

## Vitrine (demo)

Vitrine pública, para quem "só quer dar uma olhada":

**https://momauricio.github.io/juntos/**

A vitrine **não** é um modo de uso do app:

- Abre direto no quadro com dados de exemplo ("Mauricio & Ana": Café da Esquina, Praia do Félix e Cantina da Nonna já com nota)
- Uma faixa fixa no topo convida a criar a conta de vocês; o botão **Criar nossa conta** leva ao `/entrar` do app real
- Os dados ficam só no aparelho (`localStorage`); **Ajustes → Limpar dados deste aparelho** volta para os dados de exemplo
- Não há sincronização nem convite do par na vitrine (links com `?sync=` são ignorados)
- **Viagens** (checklist, roteiro por dia e documentos) existem só na vitrine, com o selo "em breve no app"

A vitrine só liga com `NEXT_PUBLIC_DEMO_MODE=true`. Sem essa flag o app nunca cai na demo sozinho, mesmo sem as variáveis do Supabase.

```bash
# .env.local
NEXT_PUBLIC_DEMO_MODE=true
# Destino do "Criar nossa conta" (o app real); sem ele, o link vira /entrar relativo
NEXT_PUBLIC_APP_URL=https://seu-app.vercel.app
```

Build estático para GitHub Pages (já liga `NEXT_PUBLIC_DEMO_MODE=true` sozinho; defina `NEXT_PUBLIC_APP_URL` antes):

```bash
NEXT_PUBLIC_APP_URL=https://seu-app.vercel.app npm run build:demo-static
```

## Setup completo (Supabase)

### 1. Environment variables

```bash
cp .env.local.example .env.local
```

Preencha `NEXT_PUBLIC_SUPABASE_URL` e `NEXT_PUBLIC_SUPABASE_ANON_KEY` e deixe `NEXT_PUBLIC_DEMO_MODE` vazio ou `false`.

| Variável | Para quê |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` / `NEXT_PUBLIC_SUPABASE_ANON_KEY` | App real. **Obrigatórias no build de produção**: `npm run build` sem elas (ou com a URL de exemplo `YOUR_PROJECT`) e sem `NEXT_PUBLIC_DEMO_MODE=true` falha com "Faltam NEXT_PUBLIC_SUPABASE_URL/ANON_KEY (ou defina NEXT_PUBLIC_DEMO_MODE=true para a vitrine)". `npm run dev` e `npm run start` não fazem essa checagem. |
| `NEXT_PUBLIC_DEMO_MODE` | `true` liga a vitrine (obrigatório para ela). Qualquer outro valor = app real. |
| `NEXT_PUBLIC_APP_URL` | Só na vitrine: URL do app real, destino do botão "Criar nossa conta" (`<APP_URL>/entrar`). |
| `NEXT_PUBLIC_DEMO_URL` | Só no app real: destino do link "Só quero dar uma olhada" da tela de boas-vindas (padrão: a vitrine pública). |

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

### 4. Login (Google + código por e-mail)

Não existe senha na UI. Cada pessoa entra com a própria conta por:

- **Google** (`signInWithOAuth`), voltando por `/auth/callback`;
- **código de 6 dígitos no e-mail** (`signInWithOtp` + `verifyOtp`, tipo `email`), sem link clicável.

`/login` e `/signup` só redirecionam para `/entrar` (preservando `?next=` e `?code=`). Contas antigas com senha continuam entrando pelo código (mesmo e-mail = mesmo usuário).

No painel do Supabase:

1. **Authentication → Providers → Email:** deixe **ativo** (o código usa esse provider). Tamanho do OTP **6**, expiração **600 s** e intervalo mínimo entre envios **60 s**. Não precisa desligar "Confirm email": o código já confirma o e-mail.
2. **Authentication → Email Templates:** em **Magic Link** e **Confirm signup**, use o assunto `Seu código do Juntos: {{ .Token }}` e cole o HTML de `supabase/templates/magic_link.html` e `supabase/templates/confirmation.html`. Os dois mandam só o código (`{{ .Token }}`).
3. **Authentication → Providers → Google:** ative com o client OAuth (tipo Web) do Google Cloud, escopos `openid email profile`, e redirect `https://<projeto>.supabase.co/auth/v1/callback`.
4. **Authentication → URL Configuration:** Site URL do app e Redirect URLs com `http://localhost:3000/**`, os previews da Vercel e o domínio de produção.
5. Para uso real, configure um SMTP próprio (o SMTP padrão do Supabase tem limite baixo).

O `supabase/config.toml` já traz essa configuração para o Supabase local (`supabase start`): templates, OTP de 6 dígitos com 10 min, 60 s entre envios e Redirect URLs de `localhost:3000`/`127.0.0.1:3000`.

## Development

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

### Couple testing script

For a quick end-to-end check with two people or two browser profiles:

1. Create account A and account B.
2. Sign in as A, go through "Seu nome" (which creates the space), paste a link in "Bora começar com um lugar?" (or tap "Pular por enquanto") and share the invite link (`/c/<code>`) from "Agora chama seu par".
3. Open the link as B, sign in and tap "Entrar no espaço de A".
4. Add a restaurant idea from an Instagram paste or URL.
5. Open the item, mark it done, and save the 3 restaurant scores.
6. Filter the list by **Já fizemos** and confirm the completed item appears.
7. (Vitrine only) Create a trip under **Viagens** and add checklist + day stops + document links.

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
5. No Supabase de produção, confira a seção [Login](#4-login-google--código-por-e-mail) (templates, Redirect URLs e Google).

## Scripts

| Command        | Description              |
| -------------- | ------------------------ |
| `npm run dev`  | Start dev server         |
| `npm run build`| Production build         |
| `npm test`     | Run Vitest once          |
| `npm run test:watch` | Run Vitest in watch mode |
