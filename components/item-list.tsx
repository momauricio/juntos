import type { ReactNode } from "react";

import { memberTone } from "@/components/avatar";
import {
  ItemCompactRow,
  ItemGridTile,
  Pressable,
  type CategoryLook,
} from "@/components/item-visuals";
import { BACK_LINK } from "@/components/ui-classes";
import { STATUS_BADGES } from "@/lib/categories";
import { coupleScore } from "@/lib/ratings";
import { UNKNOWN_AUTHOR_NAME } from "@/lib/relative-time";
import type { Item, ItemView, Rating } from "@/lib/types";

export type ItemWithRatings = Item & {
  ratings: Rating[] | null;
};

// Categoria que sumiu (apagada agora pelo par): o card não quebra.
const FALLBACK_LOOK: CategoryLook = { emoji: "📍", color: "ph1" };

export type ItemListProps = {
  items: ItemWithRatings[];
  // Cor e emoji de cada categoria, por id.
  categoriesById: Record<string, CategoryLook>;
  memberNames: Record<string, string>;
  // userIds na ordem de entrada no espaço (define a cor da bolinha).
  memberOrder?: string[];
  view?: ItemView;
  // Busca: selo "💛 Queremos"/"✓ Já fizemos" em cada linha.
  showStatus?: boolean;
  // Demo: abre por callback; sem ele, cada card é um link para /items/{id}.
  onOpen?: (itemId: string) => void;
};

// Cards novos (C14) em Compacta (uma lista) ou Grade (2 colunas).
export function ItemList({
  items,
  categoriesById,
  memberNames,
  memberOrder = [],
  view = "compact",
  showStatus = false,
  onOpen,
}: ItemListProps) {
  const cards = items.map((item) => {
    const props = {
      item,
      category: categoriesById[item.category_id] ?? FALLBACK_LOOK,
      author: {
        name: memberNames[item.created_by] ?? UNKNOWN_AUTHOR_NAME,
        tone: memberTone(memberOrder.indexOf(item.created_by)),
      },
      // O selo da nota só em Já fizemos.
      score: item.status === "done" ? coupleScore(item.ratings ?? []) : null,
      href: onOpen ? undefined : `/items/${item.id}`,
      onClick: onOpen ? () => onOpen(item.id) : undefined,
    };

    return view === "grid" ? (
      <li key={item.id}>
        <ItemGridTile {...props} />
      </li>
    ) : (
      <li key={item.id}>
        <ItemCompactRow
          {...props}
          statusBadge={showStatus ? STATUS_BADGES[item.status] : undefined}
        />
      </li>
    );
  });

  return view === "grid" ? (
    <ul className="grid grid-cols-2 gap-3">{cards}</ul>
  ) : (
    <ul className="overflow-hidden rounded-[22px] bg-surface text-ink shadow-[0_10px_24px_rgba(0,0,0,0.18)] [&>li:first-child>*]:border-t-0">
      {cards}
    </ul>
  );
}

// Cabeçalho das telas de lista (mockup 52): "← Queremos", título grande e a
// linha de baixo ("Mais recentes primeiro").
export function ListScreenHeader({
  backLabel,
  backHref,
  onBack,
  title,
  count,
  subtitle,
  right,
}: {
  backLabel: string;
  backHref?: string;
  onBack?: () => void;
  title: string;
  count?: number;
  subtitle?: string;
  // Seletor Grade/Compacta (PR 5).
  right?: ReactNode;
}) {
  return (
    <div>
      <div className="flex items-center justify-between gap-3">
        <Pressable
          href={backHref}
          onClick={onBack}
          className={`${BACK_LINK} font-semibold`}
        >
          ← {backLabel}
        </Pressable>
        {right}
      </div>
      <h1 className="mt-1 text-[27px] font-medium leading-tight text-cream">
        {title}
        {count != null ? (
          <span className="text-cream/55"> · {count}</span>
        ) : null}
      </h1>
      {subtitle ? (
        <p className="mt-1.5 text-[13.5px] text-cream/60">{subtitle}</p>
      ) : null}
    </div>
  );
}
