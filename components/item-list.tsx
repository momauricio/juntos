import type { ReactNode } from "react";

import { memberTone } from "@/components/avatar";
import {
  ItemCompactRow,
  ItemGridTile,
  Pressable,
  type CategoryLook,
  type GridImage,
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
  // Grade: foto do link de cada item, por id (os itens do app ainda não
  // guardam imagem; sem foto, vale cor + emoji).
  imagesById?: Record<string, GridImage>;
  // Grade em Queremos: último quadrado "＋ Adicionar em {nome}".
  addTile?: { label: string; href?: string; onClick?: () => void } | null;
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
  imagesById,
  addTile,
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
        <ItemGridTile {...props} image={imagesById?.[item.id] ?? null} />
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
    <ul className="grid grid-cols-2 gap-3">
      {cards}
      {addTile ? (
        <li>
          <Pressable
            href={addTile.href}
            onClick={addTile.onClick}
            className="flex aspect-square w-full flex-col items-center justify-center rounded-[22px] border-2 border-dashed border-cream/30 p-4 text-center text-cream/75 transition hover:border-cream/55 hover:text-cream"
          >
            <span aria-hidden="true" className="text-[34px] font-light leading-none">
              ＋
            </span>
            <span className="mt-1.5 text-balance text-[15px] font-bold leading-[1.35]">
              {addTile.label}
            </span>
          </Pressable>
        </li>
      ) : null}
    </ul>
  ) : (
    <ul className="overflow-hidden rounded-[22px] bg-surface text-ink shadow-[0_10px_24px_rgba(0,0,0,0.18)] [&>li:first-child>*]:border-t-0">
      {cards}
    </ul>
  );
}

// Cabeçalho das telas de lista (mockups 52/53): "← Queremos" e o seletor,
// título grande (com a média à direita, em 53) e a linha de baixo ("Mais
// recentes primeiro" ou "Ordenar: …").
export function ListScreenHeader({
  backLabel,
  backHref,
  onBack,
  title,
  count,
  subtitle,
  right,
  titleAside,
}: {
  backLabel: string;
  backHref?: string;
  onBack?: () => void;
  title: string;
  count?: number;
  subtitle?: ReactNode;
  // Seletor Grade/Compacta.
  right?: ReactNode;
  // Média das notas (Restaurante em Já fizemos).
  titleAside?: ReactNode;
}) {
  return (
    <div>
      <div className="flex min-h-11 items-center justify-between gap-3">
        <Pressable
          href={backHref}
          onClick={onBack}
          className={`${BACK_LINK} font-semibold`}
        >
          ← {backLabel}
        </Pressable>
        {right}
      </div>
      <div className="mt-1.5 flex items-center justify-between gap-3">
        <h1 className="min-w-0 text-[27px] font-medium leading-tight text-cream">
          {title}
          {count != null ? (
            <span className="whitespace-nowrap text-cream/55"> · {count}</span>
          ) : null}
        </h1>
        {titleAside}
      </div>
      {subtitle ? (
        <div className="mt-2 text-[13.5px] text-cream/60">{subtitle}</div>
      ) : null}
    </div>
  );
}
