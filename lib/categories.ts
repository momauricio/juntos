import type { Category, CategoryColor, ItemType } from "@/lib/types";

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
