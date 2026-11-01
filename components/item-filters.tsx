"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";

import type { StatusCounts } from "@/lib/item-categories";
import { STATUS_LABELS } from "@/lib/labels";
import type { ItemStatus } from "@/lib/types";

const STATUS_TABS: ItemStatus[] = ["want", "done"];

export type { StatusCounts };

export type StatusTabsProps = {
  status: ItemStatus;
  onStatusChange: (status: ItemStatus) => void;
  counts?: StatusCounts;
};

// Abas segmentadas de status (mockup .tabs): "Queremos · n" / "Já fizemos · n".
// Os chips de tipo saíram do início (agora são os quadrados de categoria).
export function StatusTabs({ status, onStatusChange, counts }: StatusTabsProps) {
  return (
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
  );
}

// Abas do app: a aba fica na URL (?status=), como antes.
export function UrlStatusTabs({
  status,
  counts,
}: {
  status: ItemStatus;
  counts?: StatusCounts;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();

  return (
    <StatusTabs
      status={status}
      counts={counts}
      onStatusChange={(nextStatus) => {
        const params = new URLSearchParams(searchParams.toString());
        params.set("status", nextStatus);
        router.push(`${pathname}?${params.toString()}`);
      }}
    />
  );
}
