"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";

import {
  CATEGORY_LABELS,
  ITEM_CATEGORIES,
  type ItemCategory,
} from "@/lib/item-categories";
import { STATUS_LABELS } from "@/lib/labels";
import type { ItemStatus } from "@/lib/types";

const STATUS_TABS: ItemStatus[] = ["want", "done"];

export type StatusCounts = Record<ItemStatus, number>;

export type ItemFiltersProps = {
  category: ItemCategory;
  status: ItemStatus;
  onCategoryChange: (category: ItemCategory) => void;
  onStatusChange: (status: ItemStatus) => void;
  counts?: StatusCounts;
};

type UrlItemFiltersProps = {
  category: ItemCategory;
  status: ItemStatus;
  counts?: StatusCounts;
};

// Abas segmentadas de status (mockup .tabs) + chips escuros de categoria (.chip.dark).
export function ItemFilters({
  category,
  status,
  onCategoryChange,
  onStatusChange,
  counts,
}: ItemFiltersProps) {
  return (
    <div className="space-y-3.5">
      <div
        role="group"
        aria-label="Status"
        className="grid grid-cols-2 rounded-2xl bg-cream/10 p-1"
      >
        {STATUS_TABS.map((itemStatus) => {
          const active = status === itemStatus;

          return (
            <button
              key={itemStatus}
              type="button"
              aria-pressed={active}
              onClick={() => onStatusChange(itemStatus)}
              className={`flex h-[42px] items-center justify-center whitespace-nowrap rounded-xl px-1 text-[15px] font-semibold transition ${
                active ? "bg-cream text-ink" : "text-cream/75 hover:text-cream"
              }`}
            >
              {STATUS_LABELS[itemStatus]}
              {counts ? ` · ${counts[itemStatus]}` : null}
            </button>
          );
        })}
      </div>

      <div role="group" aria-label="Categoria" className="flex gap-2">
        {ITEM_CATEGORIES.map((itemCategory) => {
          const active = category === itemCategory;

          return (
            <button
              key={itemCategory}
              type="button"
              aria-pressed={active}
              onClick={() => onCategoryChange(itemCategory)}
              className={`inline-flex h-[34px] shrink-0 items-center whitespace-nowrap rounded-full px-[13px] text-sm font-semibold transition ${
                active
                  ? "bg-cream text-ink"
                  : "bg-cream/[0.12] text-cream hover:bg-cream/20"
              }`}
            >
              {CATEGORY_LABELS[itemCategory]}
            </button>
          );
        })}
      </div>
    </div>
  );
}

export function UrlItemFilters({
  category,
  status,
  counts,
}: UrlItemFiltersProps) {
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();

  function push(params: URLSearchParams) {
    const query = params.toString();
    router.push(query ? `${pathname}?${query}` : pathname);
  }

  return (
    <ItemFilters
      category={category}
      status={status}
      counts={counts}
      onCategoryChange={(nextCategory) => {
        const params = new URLSearchParams(searchParams.toString());

        if (nextCategory === "all") {
          params.delete("type");
        } else {
          params.set("type", nextCategory);
        }

        // Fixa a aba atual (o padrão pode mudar quando o ?salvo= some).
        params.set("status", status);
        push(params);
      }}
      onStatusChange={(nextStatus) => {
        const params = new URLSearchParams(searchParams.toString());
        params.set("status", nextStatus);
        push(params);
      }}
    />
  );
}
