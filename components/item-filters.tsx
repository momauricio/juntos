"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";

import { STATUS_LABELS, TYPE_LABELS } from "@/lib/labels";
import type { ItemStatus, ItemType } from "@/lib/types";

const ITEM_TYPES = Object.keys(TYPE_LABELS) as ItemType[];
const ITEM_STATUSES: ItemStatus[] = ["want", "done"];

export type ItemFiltersProps = {
  type: ItemType | "all";
  status: ItemStatus | "all";
  onTypeChange: (type: ItemType | "all") => void;
  onStatusChange: (status: ItemStatus | "all") => void;
};

type UrlItemFiltersProps = {
  type: ItemType | "all";
  status: ItemStatus | "all";
};

export function ItemFilters({
  type,
  status,
  onTypeChange,
  onStatusChange,
}: ItemFiltersProps) {
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      <label className="space-y-2 text-sm font-medium text-stone-800">
        <span>Tipo</span>
        <select
          value={type}
          onChange={(event) =>
            onTypeChange(event.target.value as ItemType | "all")
          }
          className="h-11 w-full rounded-2xl border border-stone-300 bg-white px-4 text-sm outline-none transition focus:border-rose-500 focus:ring-4 focus:ring-rose-100"
        >
          <option value="all">Todos os tipos</option>
          {ITEM_TYPES.map((itemType) => (
            <option key={itemType} value={itemType}>
              {TYPE_LABELS[itemType]}
            </option>
          ))}
        </select>
      </label>

      <label className="space-y-2 text-sm font-medium text-stone-800">
        <span>Status</span>
        <select
          value={status}
          onChange={(event) =>
            onStatusChange(event.target.value as ItemStatus | "all")
          }
          className="h-11 w-full rounded-2xl border border-stone-300 bg-white px-4 text-sm outline-none transition focus:border-rose-500 focus:ring-4 focus:ring-rose-100"
        >
          <option value="all">{STATUS_LABELS.all}</option>
          {ITEM_STATUSES.map((itemStatus) => (
            <option key={itemStatus} value={itemStatus}>
              {STATUS_LABELS[itemStatus]}
            </option>
          ))}
        </select>
      </label>
    </div>
  );
}

export function UrlItemFilters({ type, status }: UrlItemFiltersProps) {
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
      onTypeChange={(nextType) => updateFilter("type", nextType)}
      onStatusChange={(nextStatus) => updateFilter("status", nextStatus)}
    />
  );
}
