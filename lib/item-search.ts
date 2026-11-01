import type { Item } from "@/lib/types";

// Busca do início (spec-layout-categorias.md C12, com a mudança do Mauricio:
// também nas notas). Pura, nos itens já carregados; a tela é do PR 4.
export const SEARCH_MIN_LENGTH = 2;

type Searchable = Pick<Item, "title" | "city" | "notes">;

// Sem acento, minúscula, sem espaços nas pontas e espaços repetidos viram 1.
// "  Café   GRAMADO " → "cafe gramado".
export function normalizeSearchText(value: string | null | undefined): string {
  return (value ?? "")
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .trim()
    .replace(/\s+/g, " ")
    .toLowerCase();
}

// A busca só começa no 2º caractere útil (depois de normalizar).
export function isSearchActive(query: string): boolean {
  return Array.from(normalizeSearchText(query)).length >= SEARCH_MIN_LENGTH;
}

// Itens cujo título, cidade ou notas contêm o texto. Ordem: os que batem no
// título, depois os que batem só na cidade, depois só nas notas; dentro de
// cada grupo, a ordem de entrada. Busca inativa (0–1 caractere) → [].
export function searchItems<T extends Searchable>(
  items: readonly T[],
  query: string,
): T[] {
  if (!isSearchActive(query)) {
    return [];
  }

  const needle = normalizeSearchText(query);
  const byTitle: T[] = [];
  const byCity: T[] = [];
  const byNotes: T[] = [];

  for (const item of items) {
    if (normalizeSearchText(item.title).includes(needle)) {
      byTitle.push(item);
    } else if (normalizeSearchText(item.city).includes(needle)) {
      byCity.push(item);
    } else if (normalizeSearchText(item.notes).includes(needle)) {
      byNotes.push(item);
    }
  }

  return [...byTitle, ...byCity, ...byNotes];
}
