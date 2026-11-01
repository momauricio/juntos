import { parseTypeParam } from "@/lib/item-categories";
import { coupleScore } from "@/lib/ratings";
import type { Category, CategoryColor, Item, ItemStatus, ItemType } from "@/lib/types";

type RatingValues = Parameters<typeof coupleScore>[0][number];

// Regras puras das categorias do casal (spec-layout-categorias.md, C1–C4 e C7).
// O banco garante as mesmas regras (supabase/migrations/20261031120000_categories.sql);
// aqui é para o app avisar antes, com a microcopy da folha 54.

// Paleta P: o banco guarda o token (classe em globals.css), nunca o hex.
export const CATEGORY_COLORS: readonly { token: CategoryColor; name: string }[] = [
  { token: "ph1", name: "terracota" },
  { token: "ph2", name: "azul-mar" },
  { token: "ph3", name: "tostado" },
  { token: "ph4", name: "sálvia" },
  { token: "ph5", name: "lilás" },
  { token: "ph6", name: "índigo" },
  { token: "ph7", name: "rosa" },
  { token: "ph8", name: "verde-mata" },
];

export const CATEGORY_LIMIT = 30;
export const CATEGORY_NAME_MAX = 24;
// Categoria criada pelo casal: nota única (spec, pergunta 3).
export const CUSTOM_CATEGORY_ITEM_TYPE: ItemType = "activity";

export type DefaultCategory = Pick<
  Category,
  "position" | "name" | "emoji" | "color" | "item_type"
>;

// Igual a public.seed_default_categories (spec §3).
export const DEFAULT_CATEGORIES: readonly DefaultCategory[] = [
  { position: 1, name: "Hospedagem", emoji: "🏨", color: "ph8", item_type: "stay" },
  { position: 2, name: "Restaurante", emoji: "🍝", color: "ph3", item_type: "restaurant" },
  { position: 3, name: "Passeio", emoji: "🏖️", color: "ph2", item_type: "tourist_spot" },
  { position: 4, name: "Programa", emoji: "🧺", color: "ph5", item_type: "activity" },
  { position: 5, name: "Comida", emoji: "☕", color: "ph1", item_type: "food_idea" },
  { position: 6, name: "Cidade", emoji: "🏙️", color: "ph4", item_type: "city" },
  { position: 7, name: "Filme", emoji: "🎬", color: "ph6", item_type: "movie" },
  { position: 8, name: "Evento", emoji: "🎟️", color: "ph7", item_type: "event" },
];

export const CATEGORY_MESSAGES = {
  nameRequired: "Dê um nome pra categoria.",
  nameTooLong: `Até ${CATEGORY_NAME_MAX} letras.`,
  duplicateName: (existingName: string) =>
    `Vocês já têm uma categoria “${existingName}”.`,
  oneEmoji: "Escolha um emoji só.",
  limit: `Vocês chegaram ao limite de ${CATEGORY_LIMIT} categorias.`,
} as const;

// Equivalente a public.category_name_key: sem acento, minúscula, sem espaços
// nas pontas e espaços repetidos viram 1. "Pubs", "pubs" e " Púbs " → "pubs".
export function categoryNameKey(name: string): string {
  return name
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .trim()
    .replace(/\s+/g, " ")
    .toLowerCase();
}

// Quantidade de caracteres como o char_length do Postgres (code points).
function charLength(value: string): number {
  return [...value].length;
}

const EMOJI_PATTERN = /\p{Extended_Pictographic}|\p{Regional_Indicator}|⃣/u;

// 1 emoji só (um grafema), que caiba nos 16 caracteres do banco.
export function isSingleEmoji(value: string): boolean {
  const trimmed = value.trim();
  if (!trimmed || charLength(trimmed) > 16) return false;
  const segments = [...new Intl.Segmenter("pt-BR", { granularity: "grapheme" }).segment(trimmed)];
  return segments.length === 1 && EMOJI_PATTERN.test(trimmed);
}

export type CategoryInput = {
  name: string;
  emoji: string;
  color: CategoryColor;
};

// Mensagem da folha 54 para o primeiro problema, ou null se está tudo certo.
// Ao editar (editingId), a própria categoria não conta para o nome repetido
// nem para o limite: renomear "Pubs" para "pubs" é permitido.
export function validateCategoryInput(
  input: CategoryInput,
  existing: readonly Pick<Category, "id" | "name">[],
  options: { editingId?: string } = {},
): string | null {
  const editing = options.editingId !== undefined;
  if (!editing && existing.length >= CATEGORY_LIMIT) {
    return CATEGORY_MESSAGES.limit;
  }

  const name = input.name.trim();
  if (!name) return CATEGORY_MESSAGES.nameRequired;
  if (charLength(name) > CATEGORY_NAME_MAX) return CATEGORY_MESSAGES.nameTooLong;

  const key = categoryNameKey(name);
  const duplicate = existing.find(
    (category) => category.id !== options.editingId && categoryNameKey(category.name) === key,
  );
  if (duplicate) return CATEGORY_MESSAGES.duplicateName(duplicate.name);

  if (!isSingleEmoji(input.emoji)) return CATEGORY_MESSAGES.oneEmoji;

  return null;
}

// Ordem dos quadrados (C7): position, empate por created_at.
export function sortCategories<T extends Pick<Category, "position" | "created_at">>(
  categories: readonly T[],
): T[] {
  return [...categories].sort(
    (a, b) =>
      a.position - b.position ||
      (a.created_at < b.created_at ? -1 : a.created_at > b.created_at ? 1 : 0),
  );
}

export type CategoryErrorCode =
  | "not_empty"
  | "limit"
  | "duplicate_name"
  | "other_space"
  | "unknown";

// Erro do Postgres/PostgREST ({ message, code }) → motivo que o app sabe tratar.
export function categoryErrorCode(
  error: { message?: string | null; code?: string | null } | null | undefined,
): CategoryErrorCode {
  const message = error?.message ?? "";
  const code = error?.code ?? "";

  if (message.includes("category_not_empty")) return "not_empty";
  // A FK items.category_id também recusa (se o trigger não pegar antes).
  if (code === "23503" && message.includes("items_category_id_fkey")) return "not_empty";
  if (message.includes("category_limit")) return "limit";
  if (code === "23505" && message.includes("categories_space_name_key_unique")) {
    return "duplicate_name";
  }
  if (message.includes("category_other_space")) return "other_space";
  return "unknown";
}

// ---------------------------------------------------------------------------
// Início por categorias (telas 50/51): quadrados, recentes, média e links.
// Tudo puro, sobre os itens já carregados (nenhuma consulta nova).

export const HOME_COPY = {
  searchPlaceholder: (total: number) => `Buscar nos ${total} lugares e ideias`,
  searchLabel: "Buscar",
  searchClear: "Limpar busca",
  searchEmpty: (text: string) => `Nada com “${text}”.`,
  recentEmoji: "🕒",
  recentTitle: "Adicionados recentemente",
  recentEmpty: "Nada ainda",
  emptySample: "nada ainda",
  newCategoryTitle: "Nova categoria",
  newCategoryHint: "Pubs, Viagem, o que vocês quiserem",
  scoreAverage: (count: number) =>
    count === 1 ? "média de 1 nota" : `média de ${count} notas`,
} as const;

// Telas de lista (52 e recentes).
export const LIST_COPY = {
  newestFirst: "Mais recentes primeiro",
  recentScreenTitle: `${HOME_COPY.recentEmoji} ${HOME_COPY.recentTitle}`,
  empty: "Nada aqui ainda.",
} as const;

// Selo da foto no card da Grade.
export const GRID_COPY = {
  photoInstagram: "📸 Instagram",
  photoLink: "📸 link",
} as const;

// Selo de status na linha da busca (as duas abas juntas).
export const STATUS_BADGES: Record<ItemStatus, string> = {
  want: "💛 Queremos",
  done: "✓ Já fizemos",
};

// Quantos itens a lista de recentes mostra e quantos nomes vão no quadrado (C8).
export const RECENT_LIMIT = 10;
export const RECENT_TILE_NAMES = 3;
// Nomes de amostra no quadrado da categoria (C5).
export const CATEGORY_SAMPLE_SIZE = 2;

type TabItem = Pick<Item, "id" | "title" | "status" | "category_id" | "created_at">;

// Mais novo primeiro (created_at desc); empate pelo id, para os dois verem igual.
function newestFirst(a: Pick<Item, "id" | "created_at">, b: Pick<Item, "id" | "created_at">) {
  if (a.created_at !== b.created_at) return a.created_at < b.created_at ? 1 : -1;
  return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
}

export type CategoryTileData<C> = {
  category: C;
  // Itens da categoria com o status da aba (C5).
  count: number;
  // Títulos dos mais novos (no máximo 2), para a amostra.
  sample: string[];
};

// Um quadrado por categoria, na ordem do casal (C7), todas nas duas abas (C6).
export function categoryTiles<
  C extends Pick<Category, "id" | "position" | "created_at">,
  I extends TabItem,
>(categories: readonly C[], items: readonly I[], status: ItemStatus): CategoryTileData<C>[] {
  const byCategory = new Map<string, I[]>();
  for (const item of items) {
    if (item.status !== status) continue;
    const list = byCategory.get(item.category_id);
    if (list) list.push(item);
    else byCategory.set(item.category_id, [item]);
  }

  return sortCategories(categories).map((category) => {
    const list = (byCategory.get(category.id) ?? []).sort(newestFirst);
    return {
      category,
      count: list.length,
      sample: list.slice(0, CATEGORY_SAMPLE_SIZE).map((item) => item.title),
    };
  });
}

// "{1}", "{1}, {2}" ou "{1}, {2}, +{n−2}"; com 0, "nada ainda".
export function categorySampleText(sample: readonly string[], count: number): string {
  if (count <= 0 || sample.length === 0) return HOME_COPY.emptySample;
  const names = sample.slice(0, CATEGORY_SAMPLE_SIZE).join(", ");
  const rest = count - Math.min(sample.length, CATEGORY_SAMPLE_SIZE);
  return rest > 0 ? `${names}, +${rest}` : names;
}

// Os 10 mais novos da aba, de todas as categorias (C8).
export function recentItems<I extends Pick<Item, "id" | "status" | "created_at">>(
  items: readonly I[],
  status: ItemStatus,
  limit: number = RECENT_LIMIT,
): I[] {
  return items
    .filter((item) => item.status === status)
    .sort(newestFirst)
    .slice(0, limit);
}

// Texto do quadrado de recentes: os 3 primeiros nomes, ou "Nada ainda".
export function recentTileText(recent: readonly Pick<Item, "title">[]): string {
  if (recent.length === 0) return HOME_COPY.recentEmpty;
  return recent
    .slice(0, RECENT_TILE_NAMES)
    .map((item) => item.title)
    .join(", ");
}

// A média só aparece em Restaurante (item_type) na aba Já fizemos (C13).
export function showsScoreAverage(
  category: Pick<Category, "item_type">,
  status: ItemStatus,
): boolean {
  return category.item_type === "restaurant" && status === "done";
}

export type ScoreAverage = { value: number; count: number };

type RatedItem = { ratings: readonly RatingValues[] | null };

// Média das notas do casal (coupleScore por item) dos itens com nota,
// 1 casa com meio para cima. Sem nenhum item com nota → null (sem selo).
export function categoryScoreAverage(items: readonly RatedItem[]): ScoreAverage | null {
  // Em décimos inteiros: 9,0 e 8,0 → (90 + 80) / 2 = 85 → 8,5.
  const tenths: number[] = [];
  for (const item of items) {
    const score = coupleScore([...(item.ratings ?? [])]);
    if (score != null) tenths.push(Math.round(score * 10));
  }
  if (tenths.length === 0) return null;

  const sum = tenths.reduce((total, value) => total + value, 0);
  // Math.round sobe o meio (x,x5 → para cima) com números positivos.
  return { value: Math.round(sum / tenths.length) / 10, count: tenths.length };
}

// Faixas do selo .bd: verde 9–10, azul 8–8,9, laranja 7–7,9, vermelho < 7.
export type ScoreBand = "green" | "blue" | "orange" | "red";

export function scoreBand(value: number): ScoreBand {
  const tenths = Math.round(value * 10);
  if (tenths >= 90) return "green";
  if (tenths >= 80) return "blue";
  if (tenths >= 70) return "orange";
  return "red";
}

export const SCORE_BAND_COLORS: Record<ScoreBand, string> = {
  green: "#4f8a5b",
  blue: "#3f6ea8",
  orange: "#c47a1e",
  red: "#b83b4b",
};

// Melhor nota (C10, para o PR 5): nota desc, empate pelo mais recente;
// sem nota no fim, por mais recentes.
export function sortByScore<I extends Pick<Item, "id" | "created_at">>(
  items: readonly I[],
  scoreOf: (item: I) => number | null,
): I[] {
  const scored = items.map((item) => ({ item, score: scoreOf(item) }));
  return scored
    .sort((a, b) => {
      if (a.score == null || b.score == null) {
        if (a.score != null) return -1;
        if (b.score != null) return 1;
      } else if (a.score !== b.score) {
        return b.score - a.score;
      }
      return newestFirst(a.item, b.item);
    })
    .map(({ item }) => item);
}

function statusQuery(status: ItemStatus | null | undefined) {
  return status ? `?status=${status}` : "";
}

export function categoryHref(categoryId: string, status?: ItemStatus | null) {
  return `/categorias/${encodeURIComponent(categoryId)}${statusQuery(status)}`;
}

export function recentHref(status: ItemStatus) {
  return `/recentes${statusQuery(status)}`;
}

// Categoria padrão de um tipo: a de menor position com aquele item_type.
export function defaultCategoryForType<
  C extends Pick<Category, "item_type" | "position" | "created_at">,
>(categories: readonly C[], type: ItemType): C | null {
  return sortCategories(categories).find((category) => category.item_type === type) ?? null;
}

// Links antigos /?type=… (C15). Sem ?type= → null (fica no início).
// Um tipo só → a categoria padrão dele; grupo com mais de um tipo (comer,
// passeios, viagens), tipo desconhecido ou categoria apagada → o início.
// O ?status= (want|done) é preservado.
export function legacyTypeRedirect<
  C extends Pick<Category, "id" | "item_type" | "position" | "created_at">,
>(
  typeParam: string | string[] | undefined,
  statusParam: string | string[] | undefined,
  categories: readonly C[],
): string | null {
  const param = Array.isArray(typeParam) ? typeParam[0] : typeParam;
  if (param === undefined) return null;

  const rawStatus = Array.isArray(statusParam) ? statusParam[0] : statusParam;
  const status = rawStatus === "want" || rawStatus === "done" ? rawStatus : null;
  const { types } = parseTypeParam(param);

  if (types && types.length === 1) {
    const category = defaultCategoryForType(categories, types[0]);
    if (category) return categoryHref(category.id, status);
  }
  return `/${statusQuery(status)}`;
}
