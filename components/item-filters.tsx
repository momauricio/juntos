"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";

import { STATUS_LABELS, TYPE_LABELS } from "@/lib/labels";
import type { ItemStatus, ItemType } from "@/lib/types";

const ITEM_TYPES = Object.keys(TYPE_LABELS) as ItemType[];
const ITEM_STATUSES: ItemStatus[] = ["want", "done"];

export type StatusCounts = Record<ItemStatus | "all", number>;

export type ItemFiltersProps = {
  type: ItemType | "all";
  status: ItemStatus | "all";
  onTypeChange: (type: ItemType | "all") => void;
  onStatusChange: (status: ItemStatus | "all") => void;
  counts?: StatusCounts;
};

type UrlItemFiltersProps = {
  type: ItemType | "all";
  status: ItemStatus | "all";
  counts?: StatusCounts;
};

const STATUS_TABS: (ItemStatus | "all")[] = ["all", ...ITEM_STATUSES];

// Abas segmentadas de status (mockup .tabs) + chips escuros de tipo (.chip.dark).
export function ItemFilters({
  type,
  status,
  onTypeChange,
  onStatusChange,
  counts,
}: ItemFiltersProps) {
  return (
    <div className="space-y-3.5">
      <div
        role="group"
        aria-label="Status"
        className="grid grid-cols-3 rounded-2xl bg-cream/10 p-1"
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

      <div
        role="group"
        aria-label="Tipo"
        className="scroll-row -mx-4 flex gap-2 overflow-x-auto px-4"
      >
        {(["all", ...ITEM_TYPES] as const).map((itemType) => {
          const active = type === itemType;

          return (
            <button
              key={itemType}
              type="button"
              aria-pressed={active}
              onClick={() => onTypeChange(itemType)}
              className={`inline-flex h-[34px] shrink-0 items-center whitespace-nowrap rounded-full px-[13px] text-sm font-semibold transition ${
                active
                  ? "bg-cream text-ink"
                  : "bg-cream/[0.12] text-cream hover:bg-cream/20"
              }`}
            >
              {itemType === "all" ? "Tudo" : TYPE_LABELS[itemType]}
            </button>
          );
        })}
      </div>
    </div>
  );
}

export function UrlItemFilters({
  type,
  status,
  counts,
}: UrlItemFiltersProps) {
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();

  function updateFilter(key: "type" | "status", value: string) {
    const params = new URLSearchParams(searchParams.toString());

    if (value === "all") {
      params.delete(key);
    } else {
      params.set(key, value);
    }

    const query = params.toString();
    router.push(query ? `${pathname}?${query}` : pathname);
  }

  return (
    <ItemFilters
      type={type}
      status={status}
      counts={counts}
      onTypeChange={(nextType) => updateFilter("type", nextType)}
      onStatusChange={(nextStatus) => updateFilter("status", nextStatus)}
    />
  );
}
