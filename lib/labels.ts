import type { ItemStatus, ItemType } from "@/lib/types";

export const TYPE_LABELS: Record<ItemType, string> = {
  restaurant: "Restaurante",
  food_idea: "Ideia de comida",
  tourist_spot: "Ponto turístico",
  movie: "Filme",
  city: "Cidade",
};

export const STATUS_LABELS: Record<ItemStatus | "all", string> = {
  all: "Todos",
  want: "Queremos",
  done: "Já fizemos",
};
