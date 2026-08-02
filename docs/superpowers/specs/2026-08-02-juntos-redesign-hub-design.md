# Juntos — Redesign Hub + Wizards (Design Spec)

**Data:** 2026-08-02  
**Status:** Aguardando revisão  
**Produto:** Juntos  
**Base:** demo atual (GitHub Pages + localStorage); backend Supabase fora deste escopo  
**Relacionado:** `2026-07-28-couple-wishlist-design.md`

## 1. Problema

O demo funciona, mas a primeira tela é lista-first e o visual parece genérico. O casal quer uma home de **decisão** (ideia vs viagem), captura em **wizard** estilo onboarding, e uma identidade visual de **viagem / descoberta**.

## 2. Objetivo

Redesenhar o demo Juntos para:

1. Home = hub de decisão (não lista)
2. Criar ideia e criar viagem via wizards multi-step
3. Viagens com **vários destinos** e **datas por destino** (período total calculado)
4. Visual “Pôr do sol na estrada”
5. Notas de **1 a 10** (em vez de 1–5)

**Sucesso:** no celular, em poucos toques, escolher Ideia ou Viagem, completar o wizard e achar a lista/viagens depois, com cara de app de casal aventureiro — não de dashboard genérico.

## 3. Fora de escopo

- Novo projeto Supabase / auth real
- Share nativo de redes sociais
- App Store / PWA
- Mudança de regras do Sync (encode/merge continua; só UI se necessário)
- Mapa, descoberta social, mais de 2 pessoas

## 4. Direção visual — “Pôr do sol na estrada”

- **Atmosfera:** gradiente indigo noturno → creme quente; não fundo flat
- **Marca:** “Juntos” como sinal hero no hub (não só nav)
- **Tipografia:** expressiva (não Inter/Roboto/Arial/system)
- **Accent:** terracotta em CTAs e dots do wizard; indigo manda na atmosfera
- **Evitar:** clichê AI cream+serif+terracotta dominante; purple-on-white; glow; pills demais; cards no hero
- **Motion:** 2–3 movimentos intencionais (ex.: entrada dos cards do hub, avanço do wizard, feedback ao salvar)
- **Mobile-first:** home e wizards pensados para iPhone

## 5. Home — hub de decisão

Primeiro viewport:

1. Marca **Juntos**
2. Dois cards grandes **empilhados** (mobile):
   - **Ideia de Role**
   - **Nova Viagem**
3. Link de texto abaixo: **Ver ideias registradas**

Sem lista, stats ou conteúdo secundário no primeiro viewport.

Navegação persistente (abaixo ou equivalente): acesso a **Viagens**, **Sync**, **Ajustes** — sem roubar o hub.

## 6. Wizard — Ideia de Role

Padrão: telas com **dots de progresso**, **Voltar** / **Continuar**.

| Passo | Conteúdo |
|-------|----------|
| 1 — Tipo | Escolher: restaurante, ideia de comida, ponto turístico, filme, cidade |
| 2 — Nome | Texto obrigatório (“o que é”) |
| 3 — Link | Colar URL (Instagram etc.); **pular** permitido se não tiver |

Ao concluir: salva o item e volta ao hub (confirmação curta opcional).

## 7. Wizard — Nova Viagem

Mesmo padrão de dots + Voltar / Continuar.

| Passo | Conteúdo |
|-------|----------|
| 1 — Título | Ex.: “Nordeste final do ano” (obrigatório) |
| 2 — Destinos | Lista ordenada; **+ Adicionar destino**; ordem = ordem da viagem (ex.: SP → Nordeste). Mínimo 1 destino |
| 3 — Datas | Início e fim **por destino**. O sistema exibe o **período total** = da data mais cedo à mais tarde entre todos os destinos |

Ao concluir: cria a viagem e abre o detalhe (checklist, roteiro, docs) — esses módulos **não** entram no wizard de criação.

### Modelo de dados (destino)

Cada destino na viagem:

- `name` (string)
- `startDate` (date)
- `endDate` (date)

Ordem no array = ordem da viagem. Período total da viagem é derivado (min start → max end), não editado à parte.

## 8. Depois do hub

### Ideias

“Ver ideias registradas” abre a lista existente: filtros por tipo, marcar feito/quero, avaliar.

### Avaliações (atualização)

Escala **1 a 10** em todos os casos:

- **Restaurante:** comida, atendimento, ambiente (1–10) → média
- **Demais tipos:** nota simples (1–10)

Itens já salvos no demo com escala antiga (1–5): na implementação, migrar ou reinterpretar de forma explícita no plano (não deixar ambíguo).

### Viagens

- Lista de viagens (aba / entrada dedicada)
- Detalhe: checklist, roteiro por dia, documentos (links) — comportamento atual preservado
- Destinos múltiplos + datas por destino passam a fazer parte do modelo da viagem

### Sync e Ajustes

Regras atuais de Sync (link encode/merge) e Ajustes mantidas; incluir novos campos de viagem/destinos no payload de sync.

## 9. Arquitetura (demo)

Unidades principais:

| Unidade | Responsabilidade |
|---------|------------------|
| Hub home | Decisão Ideia vs Viagem + link para lista |
| Wizard Ideia | Fluxo tipo → nome → link → persist |
| Wizard Viagem | Fluxo título → destinos → datas → persist + abrir detalhe |
| Lista de ideias | Browse / filtro / rating / status |
| Detalhe viagem | Checklist, roteiro, docs |
| Store demo | Estado localStorage + encode/merge sync |
| Theme | Tokens CSS (indigo, cream, terracotta, type) |

Dependências: wizards escrevem no store; hub só navega; sync serializa o mesmo store.

## 10. Erros e edge cases

- Wizard Ideia: Continuar desabilitado sem tipo (passo 1) ou sem nome (passo 2)
- Wizard Viagem: Continuar desabilitado sem título; sem ao menos 1 destino; destino sem nome; datas inválidas (`end` < `start`); sobreposição de datas entre destinos **permitida** (conexão no mesmo dia ok)
- Remover destino: permitido se sobrar ≥ 1
- Reordenar destinos: desejável no v1 deste redesign (arrastar ou subir/descer); se complexo demais no plano, mínimo é adicionar na ordem e editar depois
- Link inválido no passo 3 da ideia: avisar, mas permitir salvar se o usuário insistir (URL é opcional)

## 11. Testes

- Store: criar ideia via campos do wizard; criar viagem com 2+ destinos; período total = min/max
- Sync: round-trip com destinos e datas por destino
- UI crítica: hub mostra 2 cards + link; wizards avançam/voltam; rating 1–10

## 12. Rollout

1. Implementar no demo (branch feature)
2. `build:demo-static` + publicar `gh-pages`
3. Casal testa no iPhone via https://momauricio.github.io/juntos/
4. Supabase real quando houver slot de projeto livre
