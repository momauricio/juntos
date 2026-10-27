import { TYPE_LABELS } from "@/lib/labels";
import type { ItemType } from "@/lib/types";

// Chips do quadro (mockup): agrupam os tipos existentes; só apresentação.
export type ItemCategory = "all" | "comer" | "passeios" | "viagens";

export const ITEM_CATEGORIES: ItemCategory[] = [
  "all",
  "comer",
  "passeios",
  "viagens",
];

export const CATEGORY_LABELS: Record<ItemCategory, string> = {
  all: "Tudo",
  comer: "Comer",
  passeios: "Passeios",
  viagens: "Viagens",
};

const ALL_TYPES = Object.keys(TYPE_LABELS) as ItemType[];

const CATEGORY_TYPES: Record<Exclude<ItemCategory, "all">, ItemType[]> = {
  comer: ["restaurant", "food_idea"],
  passeios: ["tourist_spot", "event", "movie"],
  viagens: ["city"],
};

export function typesForCategory(category: ItemCategory): ItemType[] {
  return category === "all" ? ALL_TYPES : CATEGORY_TYPES[category];
}

export function categoryForType(type: ItemType): Exclude<ItemCategory, "all"> {
  const found = (Object.keys(CATEGORY_TYPES) as Exclude<ItemCategory, "all">[]).find(
    (category) => CATEGORY_TYPES[category].includes(type),
  );

  if (!found) {
    throw new Error(`Tipo sem categoria: ${type}`);
  }

  return found;
}

export type TypeParamFilter = {
  // Chip destacado.
  category: ItemCategory;
  // Tipos a buscar; null = sem filtro de tipo.
  types: ItemType[] | null;
};

// ?type=comer|passeios|viagens, ou um tipo único antigo (?type=restaurant).
export function parseTypeParam(
  value: string | string[] | undefined,
): TypeParamFilter {
  const param = Array.isArray(value) ? value[0] : value;

  if (param === "comer" || param === "passeios" || param === "viagens") {
    return { category: param, types: CATEGORY_TYPES[param] };
  }

  if (param && ALL_TYPES.includes(param as ItemType)) {
    const type = param as ItemType;
    return { category: categoryForType(type), types: [type] };
  }

  return { category: "all", types: null };
}
