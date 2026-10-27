"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

import {
  ALL_CHIP_LABEL,
  TYPE_CHIPS,
  type StatusCounts,
  type TypeChip,
} from "@/lib/item-categories";
import { STATUS_LABELS, TYPE_CHIP_LABELS, TYPE_EMOJI } from "@/lib/labels";
import type { ItemStatus } from "@/lib/types";

const STATUS_TABS: ItemStatus[] = ["want", "done"];

export type { StatusCounts };

export type ItemFiltersProps = {
  // null = nenhum chip destacado (link antigo com grupo de tipos).
  typeChip: TypeChip | null;
  status: ItemStatus;
  onTypeChange: (chip: TypeChip) => void;
  onStatusChange: (status: ItemStatus) => void;
  counts?: StatusCounts;
};

type UrlItemFiltersProps = {
  typeChip: TypeChip | null;
  status: ItemStatus;
  counts?: StatusCounts;
};

// Abas segmentadas de status (mockup .tabs) + chips escuros de tipo (.chip.dark),
// numa linha com rolagem horizontal.
export function ItemFilters({
  typeChip,
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

      <div
        role="group"
        aria-label="Tipo"
        className="scroll-row -mr-5 flex gap-2 overflow-x-auto pr-5"
      >
        {TYPE_CHIPS.map((chip) => {
          const active = typeChip === chip;

          return (
            <button
              key={chip}
              type="button"
              aria-pressed={active}
              onClick={() => onTypeChange(chip)}
              className={`inline-flex h-[34px] shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full px-[13px] text-sm font-semibold transition ${
                active
                  ? "bg-cream text-ink"
                  : "bg-cream/[0.12] text-cream hover:bg-cream/20"
              }`}
            >
              {chip === "all" ? (
                ALL_CHIP_LABEL
              ) : (
                <>
                  <span aria-hidden="true">{TYPE_EMOJI[chip]}</span>
                  {TYPE_CHIP_LABELS[chip]}
                </>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}

const FOOTER = "mt-2 text-center text-sm text-cream/65";
const FOOTER_LINK = "underline underline-offset-2 hover:text-cream";

// Rodapé com filtro de tipo ativo (mockup 21b): "3 programas em Queremos · ver tudo".
export function TypeFilterFooter({
  summary,
  href,
  onShowAll,
}: {
  summary: string;
  href?: string;
  onShowAll?: () => void;
}) {
  return (
    <p className={FOOTER}>
      {summary} ·{" "}
      {href ? (
        <Link href={href} className={FOOTER_LINK}>
          ver tudo
        </Link>
      ) : (
        <button type="button" onClick={onShowAll} className={FOOTER_LINK}>
          ver tudo
        </button>
      )}
    </p>
  );
}

export function UrlItemFilters({
  typeChip,
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
      typeChip={typeChip}
      status={status}
      counts={counts}
      onTypeChange={(nextChip) => {
        const params = new URLSearchParams(searchParams.toString());

        if (nextChip === "all") {
          params.delete("type");
        } else {
          params.set("type", nextChip);
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
