# Wishlist do Casal — Design Spec (v1)

**Data:** 2026-07-28  
**Status:** Aguardando revisão  
**Nome provisório do produto:** a definir na implementação (ex.: Nós, Juntos, Indica)

## 1. Problema

Hoje o casal usa o Trello para anotar lugares e estabelecimentos que querem visitar (muitas vezes a partir de links do Instagram). Depois de ir, atribuem notas para comida, atendimento e ambiente. O fluxo funciona, mas não é feito para esse uso: tipos misturados, convite/compartilhamento improvisado e avaliação pouco estruturada.

## 2. Objetivo do v1

Um **web app privado para casal** onde os dois:

1. Salvam ideias (colando link ou só o nome)
2. Organizam por tipo
3. Marcam como feito depois de realizar
4. Avaliam (notas detalhadas para restaurante; nota simples para os outros tipos)

**Sucesso:** os dois abandonam o Trello para esse uso e conseguem, em poucos toques no iPhone, salvar → filtrar → marcar feito → notar.

## 3. Fora de escopo (v1)

- Compartilhar direto de Instagram, Facebook, TikTok, YouTube, Pinterest
- App nativo / App Store / Play Store
- PWA instalável (pode vir logo após o v1, sem mudar o núcleo)
- Importar do Trello
- Mais de 2 pessoas no espaço
- Feed público, descoberta social, mapa
- Sync offline
- Notificações push
- Notas detalhadas para tipos que não sejam restaurante

## 4. Personas e modelo social

- Duas contas pessoais (marido e esposa)
- Um **espaço compartilhado** (“Nós dois”)
- Máximo de **2 membros** por espaço no v1
- Tudo privado: só membros do espaço veem e editam

### Convite

1. Um usuário cria o espaço
2. O app gera código/link de **uso único**, com expiração (7 dias)
3. O outro cria/entra na conta e resgata o convite
4. Passa a ver a mesma lista
5. Se o espaço já tem 2 membros, novos resgates são rejeitados com mensagem clara
6. Em Configurações: ver/regenerar convite enquanto o segundo membro não entrou (regenerar invalida o código anterior)

## 5. Tipos de item

| Tipo | Campos ao salvar | Depois de fazer |
|------|------------------|-----------------|
| Restaurante | nome, link opcional, observação opcional | status feito + comida, atendimento, ambiente (1–5) → média |
| Ideia de comida | nome, link opcional, observação opcional | feito + nota simples (1–5) |
| Ponto turístico | nome, link opcional, observação opcional | feito + nota simples (1–5) |
| Filme | nome, link opcional, observação opcional | feito + nota simples (1–5) |
| Cidade | nome, link opcional, observação opcional | feito + nota simples (1–5) |

- Nome é obrigatório
- Link é opcional (URL colada manualmente no v1; pode ser estranha/incompleta — ainda assim salva)
- Observação é texto livre opcional

## 6. Fluxos principais

### 6.1 Onboarding

```text
Criar conta → Criar espaço OU Entrar com convite → Home
```

### 6.2 Salvar ideia (v1)

```text
Instagram (ou outra fonte) → copiar link → app → + Adicionar
→ tipo + nome + link + observação → Salvar → aparece em "Queremos"
```

### 6.3 Realizar e avaliar

```text
Abrir item → Marcar como feito → formulário de nota → Salvar
→ item vai para "Já fizemos" com nota/média visível
```

### 6.4 Consultar

```text
Home → filtrar por tipo e/ou Queremos | Já fizemos | Todos → abrir detalhe
```

## 7. Telas

1. **Entrar / criar conta** — e-mail + senha via Supabase Auth
2. **Onboarding do casal** — criar espaço ou colar código/link de convite
3. **Home (lista)** — filtros por tipo e status; CTA “+ Adicionar”
4. **Adicionar / editar item** — tipo, nome, link, observação
5. **Detalhe do item** — dados, status, avaliação, quem criou / quem avaliou por último
6. **Configurações** — convite (se ainda houver vaga), logout  
   - No v1 **não** há “sair do espaço” nem exclusão de espaço; o vínculo é permanente até evolução futura

Princípios de UI: mobile-first no iPhone; lista clara; sem dashboard, stats strips ou cards decorativos no hero/home.

## 8. Arquitetura

```text
Next.js (App Router)  →  Supabase Auth
                      →  Postgres + RLS
                      →  deploy Vercel
```

- Frontend web responsivo
- Backend-as-a-service: Supabase (auth, DB, row-level security)
- Sem servidor próprio além do que o Next.js precisar para SSR/rotas

### Evolução prevista (não v1)

1. PWA (“Adicionar à Tela de Início”)
2. Share targets / deep links para redes sociais
3. Empacotar com Expo/Capacitor → App Store (ambos usam iPhone)

## 9. Modelo de dados

### `profiles` (espelha `auth.users`)

- `id` (uuid, FK auth.users)
- `display_name` (default: parte local do e-mail; editável depois se quisermos)
- `created_at`
- Criado automaticamente no primeiro login (trigger)

### `spaces`

- `id`
- `name` (default: “Nós dois”)
- `created_by`
- `created_at`

### `space_members`

- `space_id`
- `user_id`
- `role` (`owner` | `member`)
- `joined_at`
- Unique `(space_id, user_id)`
- Constraint de negócio: no máximo 2 membros por `space_id`

### `invites`

- `id`
- `space_id`
- `code` (curto, único)
- `created_by`
- `expires_at`
- `redeemed_at` (nullable)
- `redeemed_by` (nullable)
- Convites não resgatados podem ser regenerados pelo owner

### `items`

- `id`
- `space_id`
- `type`: `restaurant` | `food_idea` | `tourist_spot` | `movie` | `city`
- `title` (obrigatório)
- `url` (nullable)
- `notes` (nullable)
- `status`: `want` | `done`
- `created_by`
- `updated_at`
- `created_at`
- `completed_at` (nullable)

### `ratings`

- `id`
- `item_id` (unique — **uma avaliação compartilhada do casal por item**; qualquer membro cria ou edita)
- `rated_by` (último a salvar)
- Para restaurante: `food` (1–5), `service` (1–5), `ambiance` (1–5); `score` null
- Para outros tipos: `score` (1–5); `food`/`service`/`ambiance` null
- `created_at`, `updated_at`
- Média de restaurante = `(food + service + ambiance) / 3`, calculada na leitura (1 casa decimal)

## 10. Regras de acesso (RLS)

- Usuário autenticado só lê/escreve dados de espaços em que é `space_member`
- Criar espaço: cria `spaces` + `space_members` (owner)
- Resgatar convite: falha se espaço já tem 2 membros, se código inválido/expirado/já usado
- Itens e ratings: CRUD apenas para membros do espaço do item

## 11. Tratamento de erros (v1)

| Situação | Comportamento |
|----------|----------------|
| Convite inválido / expirado / já usado | Mensagem clara; não entra no espaço |
| Espaço cheio (2/2) | Mensagem clara |
| Sem nome no item | Validação no formulário |
| URL estranha | Aceita; não tenta preview rico no v1 |
| Falha de rede ao salvar | Toast/erro; usuário tenta de novo |
| Usuário sem espaço | Força onboarding (criar ou convite) |

## 12. Testes

- Testes unitários das regras de nota (média de restaurante; score simples)
- Testes de integração/RLS: membro vê; não-membro não vê; terceiro não entra em espaço cheio
- Teste manual no iPhone Safari: criar espaço, convidar, adicionar 1 item de cada tipo, marcar restaurante como feito com 3 notas, filtrar lista

## 13. Roadmap curto (pós-v1)

1. Validar hábito com o casal (1–2 semanas de uso real)
2. PWA + ícone na tela inicial
3. Share from Instagram / TikTok / YouTube / Pinterest / Facebook
4. Importação assistida do Trello
5. App Store se o hábito estiver consolidado

## 14. Decisões travadas

- Público: só o casal (opção A)
- Escopo de tipos: 5 tipos desde o v1; só restaurante com notas detalhadas (opção C)
- Captura: colar link no v1; share nativo depois (opção C)
- Distribuição: web primeiro; App Store depois
- Stack: Next.js + Supabase + Vercel
- Auth: e-mail + senha
- Capacidade do espaço: 2 pessoas
- Avaliação: uma por item, compartilhada (não duas notas individuais)
- Convite: código de uso único, expira em 7 dias, regenerável até o 2º membro entrar
