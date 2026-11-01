"use client";

import { useId, useState } from "react";

import { formatDayMonth, Pressable, ScoreBadge } from "@/components/item-visuals";
import { ItemList, type ItemWithRatings } from "@/components/item-list";
import {
  categoryHref,
  categorySampleText,
  categoryScoreAverage,
  categoryTiles,
  HOME_COPY,
  recentHref,
  recentItems,
  recentTileText,
  showsScoreAverage,
} from "@/lib/categories";
import { isSearchActive, searchItems } from "@/lib/item-search";
import type { Category, ItemStatus } from "@/lib/types";

export type HomeCategory = Pick<
  Category,
  "id" | "name" | "emoji" | "color" | "position" | "item_type" | "created_at"
>;

export type HomeTarget =
  | { kind: "category"; id: string }
  | { kind: "recent" }
  | { kind: "item"; id: string };

type CategoryHomeProps = {
  categories: HomeCategory[];
  // Todos os itens do espaço (as duas abas): a busca procura nos dois status.
  items: ItemWithRatings[];
  status: ItemStatus;
  memberNames: Record<string, string>;
  memberOrder: string[];
  // Demo: navega por callback. Sem ele, cada quadrado é um link
  // (/categorias/{id}?status=…, /recentes?status=…, /items/{id}).
  onOpen?: (target: HomeTarget) => void;
  // Ponto de extensão do PR 6 (folha 54). Sem handler, o quadrado
  // "+ Nova categoria" não aparece: nada de botão que não faz nada.
  onNewCategory?: () => void;
};

const TILE =
  "relative flex aspect-square w-full flex-col overflow-hidden rounded-[24px] p-3.5 text-left shadow-[0_10px_24px_rgba(0,0,0,0.25)] transition hover:-translate-y-0.5";
const TILE_SHADE =
  "pointer-events-none absolute inset-0 bg-[linear-gradient(180deg,transparent_45%,rgba(10,14,26,0.35))]";
const TILE_TEXT_SHADOW = "[text-shadow:0_1px_6px_rgba(0,0,0,0.3)]";

// Início por categorias (telas 50/51): busca, "Adicionados recentemente",
// um quadrado por categoria e, com o PR 6, "+ Nova categoria".
export function CategoryHome({
  categories,
  items,
  status,
  memberNames,
  memberOrder,
  onOpen,
  onNewCategory,
}: CategoryHomeProps) {
  const [query, setQuery] = useState("");
  const searching = isSearchActive(query);
  const categoriesById = Object.fromEntries(
    categories.map((category) => [category.id, category]),
  );
  const listProps = {
    categoriesById,
    memberNames,
    memberOrder,
    onOpen: onOpen
      ? (id: string) => onOpen({ kind: "item", id })
      : undefined,
  };

  return (
    <div className="space-y-3.5">
      <SearchField value={query} onChange={setQuery} total={items.length} />

      {searching ? (
        <SearchResults query={query} items={items} listProps={listProps} />
      ) : (
        <CategoryGrid
          categories={categories}
          items={items}
          status={status}
          onOpen={onOpen}
          onNewCategory={onNewCategory}
        />
      )}
    </div>
  );
}

function SearchField({
  value,
  onChange,
  total,
}: {
  value: string;
  onChange: (value: string) => void;
  total: number;
}) {
  const id = useId();

  return (
    <div className="flex h-11 items-center gap-2.5 rounded-[14px] border border-cream/[0.14] bg-cream/10 px-3.5 focus-within:border-cream/40">
      <label htmlFor={id} className="text-[17px] leading-none">
        <span aria-hidden="true">🔍</span>
        <span className="sr-only">{HOME_COPY.searchLabel}</span>
      </label>
      <input
        id={id}
        type="search"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === "Escape") onChange("");
        }}
        placeholder={HOME_COPY.searchPlaceholder(total)}
        autoComplete="off"
        enterKeyHint="search"
        className="h-full min-w-0 flex-1 bg-transparent text-[15.5px] text-cream! outline-none placeholder:text-cream/60! [&::-webkit-search-cancel-button]:hidden"
      />
      {value ? (
        <button
          type="button"
          onClick={() => onChange("")}
          aria-label={HOME_COPY.searchClear}
          className="-mr-2 flex h-11 w-9 shrink-0 items-center justify-center text-lg text-cream/60 transition hover:text-cream"
        >
          <span aria-hidden="true">✕</span>
        </button>
      ) : null}
    </div>
  );
}

// Resultado da busca (C12): Compacta, nas duas abas, com o selo de status.
function SearchResults({
  query,
  items,
  listProps,
}: {
  query: string;
  items: ItemWithRatings[];
  listProps: Omit<Parameters<typeof ItemList>[0], "items">;
}) {
  const results = searchItems(items, query);

  return (
    <div role="region" aria-live="polite" aria-label={HOME_COPY.searchLabel}>
      {results.length === 0 ? (
        <p className="px-1 py-6 text-center text-[15px] text-cream/70">
          {HOME_COPY.searchEmpty(query.trim())}
        </p>
      ) : (
        <ItemList items={results} showStatus {...listProps} />
      )}
    </div>
  );
}

function CategoryGrid({
  categories,
  items,
  status,
  onOpen,
  onNewCategory,
}: {
  categories: HomeCategory[];
  items: ItemWithRatings[];
  status: ItemStatus;
  onOpen?: (target: HomeTarget) => void;
  onNewCategory?: () => void;
}) {
  const recent = recentItems(items, status);
  const tiles = categoryTiles(categories, items, status);

  return (
    <ul className="grid grid-cols-2 gap-2.5">
      <li>
        <Pressable
          href={recentHref(status)}
          onClick={onOpen ? () => onOpen({ kind: "recent" }) : undefined}
          className={`${TILE} bg-surface text-ink`}
        >
          <span className="flex items-start justify-between">
            <span aria-hidden="true" className="text-[38px] leading-none">
              {HOME_COPY.recentEmoji}
            </span>
            {recent[0] ? (
              <span className="text-[12.5px] font-bold text-ink/65">
                {formatDayMonth(recent[0].created_at)}
              </span>
            ) : null}
          </span>
          <span className="mt-auto text-[17.5px] font-bold leading-[1.15]">
            {HOME_COPY.recentTitle}
          </span>
          <span className="mt-[3px] line-clamp-2 text-[12.5px] leading-[1.3] text-ink/70">
            {recentTileText(recent)}
          </span>
        </Pressable>
      </li>

      {tiles.map(({ category, count, sample }) => {
        const average = showsScoreAverage(category, status)
          ? categoryScoreAverage(
              items.filter(
                (item) =>
                  item.category_id === category.id && item.status === status,
              ),
            )
          : null;

        return (
          <li key={category.id}>
            <Pressable
              href={categoryHref(category.id, status)}
              onClick={
                onOpen
                  ? () => onOpen({ kind: "category", id: category.id })
                  : undefined
              }
              className={`${TILE} text-white ${category.color}`}
            >
              <span aria-hidden="true" className={TILE_SHADE} />
              <span className="relative flex items-start justify-between">
                <span aria-hidden="true" className="text-[42px] leading-none">
                  {category.emoji}
                </span>
                <span
                  className={`font-serif text-[28px] font-semibold leading-none ${TILE_TEXT_SHADOW}`}
                >
                  {count}
                </span>
              </span>
              <span
                className={`relative mt-auto text-[19px] font-bold leading-[1.15] ${TILE_TEXT_SHADOW}`}
              >
                {category.name}
              </span>
              {average ? (
                <span className="relative mt-1 flex items-center gap-1.5">
                  <ScoreBadge
                    value={average.value}
                    className="rounded-lg px-2 py-0.5 text-[13.5px]"
                  />
                  <span className="text-xs opacity-90">
                    {HOME_COPY.scoreAverage(average.count)}
                  </span>
                </span>
              ) : null}
              <span
                className={`relative mt-[3px] text-[12.5px] leading-[1.3] opacity-[0.92] [text-shadow:0_1px_4px_rgba(0,0,0,0.3)] ${
                  average ? "line-clamp-1" : "line-clamp-2"
                }`}
              >
                {categorySampleText(sample, count)}
              </span>
            </Pressable>
          </li>
        );
      })}

      {onNewCategory ? (
        <li>
          <button
            type="button"
            onClick={onNewCategory}
            className="flex aspect-square w-full flex-col items-center justify-center rounded-[24px] border-2 border-dashed border-cream/35 p-3.5 text-center text-cream transition hover:border-cream/60"
          >
            <span aria-hidden="true" className="text-[40px] font-light leading-none">
              ＋
            </span>
            <span className="mt-1.5 text-lg font-bold">
              {HOME_COPY.newCategoryTitle}
            </span>
            <span className="mt-[3px] text-[12.5px] text-cream/60">
              {HOME_COPY.newCategoryHint}
            </span>
          </button>
        </li>
      ) : null}
    </ul>
  );
}
