import { categoryForType, type ItemCategory } from "@/lib/item-categories";
import type { Item, ItemStatus, ItemType } from "@/lib/types";

export type TypeFilter = ItemType | "all";
export type StatusFilter = ItemStatus | "all";

export function filterItems(
  items: Item[],
  typeFilter: TypeFilter,
  statusFilter: StatusFilter,
): Item[] {
  return items.filter((item) => {
    const typeOk = typeFilter === "all" || item.type === typeFilter;
    const statusOk = statusFilter === "all" || item.status === statusFilter;
    return typeOk && statusOk;
  });
}

/** A rated item is always "done": switch away from "want" so it stays visible. */
export function statusFilterAfterRating(current: StatusFilter): StatusFilter {
  return current === "want" ? "done" : current;
}

export function typeFilterAfterRating(current: TypeFilter, itemType: ItemType): TypeFilter {
  return current === "all" || current === itemType ? current : "all";
}

export function categoryFilterAfterRating(
  current: ItemCategory,
  itemType: ItemType,
): ItemCategory {
  return current === "all" || current === categoryForType(itemType) ? current : "all";
}

export function ratingSavedMessage(title: string, wasWant: boolean): string {
  return wasWant ? `Nota salva! ${title} agora está em Já fizemos ✨` : "Nota salva.";
}
