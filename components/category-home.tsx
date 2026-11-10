"use client";

import {
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
  type KeyboardEvent as ReactKeyboardEvent,
  type MouseEvent as ReactMouseEvent,
  type PointerEvent as ReactPointerEvent,
  type ReactNode,
} from "react";

import {
  useCategoryManager,
  type CategoryApi,
  type ManagedCategory,
  type TilePreview,
} from "@/components/category-manager";
import {
  CategoryTileFace,
  TILE_BASE,
} from "@/components/category-tile";
import { formatDayMonth, Pressable, ScoreBadge } from "@/components/item-visuals";
import { ItemList, type ItemWithRatings } from "@/components/item-list";
import { AnchoredMenu } from "@/components/overlay";
import { HOVER_LIFT } from "@/components/ui-classes";
import { holdWhileOpen } from "@/lib/live-pause";
import {
  CATEGORY_MENU_COPY,
  CATEGORY_UNKNOWN_ERROR,
  categoryHref,
  categoryMoveOptions,
  categorySampleText,
  categoryScoreAverage,
  categoryTiles,
  HOME_COPY,
  isMenuKey,
  moveCategory,
  moveCategoryTo,
  recentHref,
  recentItems,
  recentTileText,
  sameOrder,
  showsScoreAverage,
  sortCategories,
} from "@/lib/categories";
import { isSearchActive, searchItems } from "@/lib/item-search";
import type { ItemStatus } from "@/lib/types";

export type HomeCategory = ManagedCategory;

export type HomeTarget =
  | { kind: "category"; id: string }
  | { kind: "recent" }
  | { kind: "item"; id: string };

// Gerenciar categorias (PR 6): folha 54, menu 55, modo de ordem e 55b/55c.
export type HomeManage = {
  api: CategoryApi;
  // 55b "Ver os itens": abre a categoria na aba que tem itens.
  onSeeItems: (category: ManagedCategory, status: ItemStatus) => void;
  // Abre já no modo de ordem ("Mudar ordem" no "···" da categoria).
  initialReorder?: boolean;
  // Saiu do modo de ordem ("Pronto").
  onReorderEnd?: () => void;
};

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
  // Sem isso, nada de "+ Nova categoria" nem menu (nada de botão que não faz nada).
  manage?: HomeManage;
};

const TILE = `${TILE_BASE} transition hover:-translate-y-0.5 ${HOVER_LIFT}`;
// Segurar o quadrado não pode abrir a prévia do link nem selecionar texto.
const NO_CALLOUT = "select-none [-webkit-touch-callout:none]";
const LONG_PRESS_MS = 500;
// Dedo que andou mais que isso está rolando a tela, não segurando.
const LONG_PRESS_SLOP = 10;

// Início por categorias (telas 50/51): busca, "Adicionados recentemente",
// um quadrado por categoria e "+ Nova categoria".
export function CategoryHome({
  categories,
  items,
  status,
  memberNames,
  memberOrder,
  onOpen,
  manage,
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
      {searching || !manage ? (
        <>
          <SearchField value={query} onChange={setQuery} total={items.length} />
          {searching ? (
            <SearchResults query={query} items={items} listProps={listProps} />
          ) : (
            <CategoryGrid
              categories={categories}
              items={items}
              status={status}
              onOpen={onOpen}
            />
          )}
        </>
      ) : (
        <ManagedGrid
          categories={categories}
          items={items}
          status={status}
          onOpen={onOpen}
          manage={manage}
          search={<SearchField value={query} onChange={setQuery} total={items.length} />}
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
    <div className="flex h-11 items-center gap-2.5 rounded-[14px] border border-cream/[0.14] bg-cream/10 px-3.5 focus-within:border-cream/40 lg:max-w-xl">
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

type TileMenu = {
  // Abre o menu 55 a partir do quadrado.
  open: (category: ManagedCategory, anchor: HTMLElement, preview: TilePreview) => void;
  liftedId: string | null;
};

type GridProps = {
  categories: HomeCategory[];
  items: ItemWithRatings[];
  status: ItemStatus;
  onOpen?: (target: HomeTarget) => void;
  menu?: TileMenu;
  onNewCategory?: (trigger: HTMLElement) => void;
};

// Grade de quadrados com o menu ligado: o gerente (folhas/menu/toast) e o
// modo de ordem moram aqui.
function ManagedGrid({
  manage,
  search,
  ...grid
}: Omit<GridProps, "menu" | "onNewCategory"> & {
  manage: HomeManage;
  search: ReactNode;
}) {
  const [reordering, setReordering] = useState(manage.initialReorder ?? false);
  // Quadrado que recebe o foco ao entrar no modo de ordem.
  const [focusId, setFocusId] = useState<string | null>(null);
  const manager = useCategoryManager({
    categories: grid.categories,
    api: manage.api,
    onReorder: (category) => {
      setFocusId(category.id);
      setReordering(true);
    },
    onSeeItems: manage.onSeeItems,
  });

  return (
    <>
      {reordering ? (
        <ReorderGrid
          {...grid}
          focusId={focusId}
          onMove={async (ids) => {
            const result = await manage.api.move(ids);
            if (!result.ok) manager.notify(CATEGORY_UNKNOWN_ERROR);
          }}
          onDone={() => {
            setReordering(false);
            manage.onReorderEnd?.();
          }}
        />
      ) : (
        <>
          {search}
          <CategoryGrid
            {...grid}
            menu={{
              open: (category, anchor, preview) =>
                manager.openMenu(category, anchor, preview),
              liftedId: manager.menuCategoryId,
            }}
            onNewCategory={manager.openCreate}
          />
        </>
      )}
      {manager.element}
    </>
  );
}

// Segurar 500 ms (toque), botão direito ou tecla de menu → menu 55. Segurar
// não navega: o clique que vem depois é engolido.
function useTileMenuHandlers(menu: TileMenu | undefined) {
  const timer = useRef<number | null>(null);
  const start = useRef<{ x: number; y: number } | null>(null);
  const fired = useRef(false);

  function clear() {
    if (timer.current) window.clearTimeout(timer.current);
    timer.current = null;
    start.current = null;
  }

  useEffect(() => clear, []);

  return (category: ManagedCategory, preview: TilePreview) => {
    if (!menu) return {};
    const open = (element: HTMLElement) => menu.open(category, element, preview);

    return {
      onPointerDown: (event: ReactPointerEvent<HTMLElement>) => {
        fired.current = false;
        if (event.pointerType === "mouse") return;
        clear();
        start.current = { x: event.clientX, y: event.clientY };
        const element = event.currentTarget;
        timer.current = window.setTimeout(() => {
          fired.current = true;
          clear();
          navigator.vibrate?.(10);
          open(element);
        }, LONG_PRESS_MS);
      },
      onPointerMove: (event: ReactPointerEvent<HTMLElement>) => {
        const from = start.current;
        if (
          from &&
          Math.hypot(event.clientX - from.x, event.clientY - from.y) > LONG_PRESS_SLOP
        ) {
          clear();
        }
      },
      onPointerUp: clear,
      onPointerCancel: clear,
      onPointerLeave: clear,
      onContextMenu: (event: ReactMouseEvent<HTMLElement>) => {
        event.preventDefault();
        clear();
        open(event.currentTarget);
      },
      onClickCapture: (event: ReactMouseEvent<HTMLElement>) => {
        if (!fired.current) return;
        fired.current = false;
        event.preventDefault();
        event.stopPropagation();
      },
      onKeyDown: (event: ReactKeyboardEvent<HTMLElement>) => {
        if (!isMenuKey(event)) return;
        event.preventDefault();
        open(event.currentTarget);
      },
    };
  };
}

function tileData(categories: HomeCategory[], items: ItemWithRatings[], status: ItemStatus) {
  return categoryTiles(categories, items, status).map((tile) => ({
    ...tile,
    sampleText: categorySampleText(tile.sample, tile.count),
    average: showsScoreAverage(tile.category, status)
      ? categoryScoreAverage(
          items.filter(
            (item) => item.category_id === tile.category.id && item.status === status,
          ),
        )
      : null,
  }));
}

function AverageLine({ average }: { average: { value: number; count: number } }) {
  return (
    <span className="relative mt-1 flex items-center gap-1.5">
      <ScoreBadge value={average.value} className="rounded-lg px-2 py-0.5 text-[13.5px]" />
      <span className="text-xs opacity-90">{HOME_COPY.scoreAverage(average.count)}</span>
    </span>
  );
}

function RecentTile({
  items,
  status,
  onOpen,
}: {
  items: ItemWithRatings[];
  status: ItemStatus;
  onOpen?: (target: HomeTarget) => void;
}) {
  const recent = recentItems(items, status);

  return (
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
  );
}

function CategoryGrid({
  categories,
  items,
  status,
  onOpen,
  menu,
  onNewCategory,
}: GridProps) {
  const tiles = tileData(categories, items, status);
  const menuHandlers = useTileMenuHandlers(menu);

  return (
    <ul className="grid grid-cols-2 gap-2.5 md:grid-cols-3 md:gap-3.5 lg:grid-cols-4 xl:grid-cols-5">
      {/* "Adicionados recentemente" não tem menu. */}
      <li>
        <RecentTile items={items} status={status} onOpen={onOpen} />
      </li>

      {tiles.map(({ category, count, sampleText, average }) => {
        const lifted = menu?.liftedId === category.id;
        return (
          <li
            key={category.id}
            // Menu aberto: o quadrado fica por cima da tela escurecida (mockup 55).
            className={
              lifted
                ? "relative z-[45] scale-[1.04] rounded-[24px] shadow-[0_24px_50px_rgba(0,0,0,0.6)] transition-transform"
                : undefined
            }
          >
            <Pressable
              href={categoryHref(category.id, status)}
              onClick={
                onOpen
                  ? () => onOpen({ kind: "category", id: category.id })
                  : undefined
              }
              className={`${TILE} text-white ${category.color} ${menu ? NO_CALLOUT : ""}`}
              {...menuHandlers(category, { count, sample: sampleText })}
            >
              <CategoryTileFace
                emoji={category.emoji}
                name={category.name}
                count={count}
                sample={sampleText}
                sampleLines={average ? 1 : 2}
                extra={average ? <AverageLine average={average} /> : null}
              />
            </Pressable>
          </li>
        );
      })}

      {onNewCategory ? (
        <li>
          <button
            type="button"
            onClick={(event) => onNewCategory(event.currentTarget)}
            className="flex aspect-square w-full flex-col items-center justify-center rounded-[24px] border-2 border-dashed border-cream/35 p-3.5 text-center text-cream transition hover:border-cream/60 md:hover:bg-cream/[0.06]"
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

type Drag = {
  id: string;
  pointerId: number;
  startOrder: string[];
  // Onde o dedo pegou o quadrado (para ele seguir o dedo).
  grabX: number;
  grabY: number;
  x: number;
  y: number;
  moved: boolean;
};

// A ordem local (do arrastar) com o que o par mudou no meio: some quem foi
// apagada, entra no fim quem foi criada.
function mergeOrder(order: string[], ids: string[]): string[] {
  const known = order.filter((id) => ids.includes(id));
  return [...known, ...ids.filter((id) => !known.includes(id))];
}

const AUTO_SCROLL_EDGE = 70;
const AUTO_SCROLL_STEP = 14;

// Modo de ordem: alça "↕" nos quadrados, arrastar (mouse, toque e caneta) e,
// sem arrastar, "Mover para cima/baixo" no menu de cada quadrado. Cada soltura
// grava a ordem (o par vê na hora); "Pronto" só sai do modo.
function ReorderGrid({
  categories,
  items,
  status,
  focusId,
  onMove,
  onDone,
}: Omit<GridProps, "menu" | "onNewCategory" | "onOpen"> & {
  focusId: string | null;
  onMove: (ids: string[]) => Promise<void>;
  onDone: () => void;
}) {
  const sortedIds = sortCategories(categories).map((category) => category.id);
  const [localOrder, setLocalOrder] = useState<string[]>(sortedIds);
  const order = mergeOrder(localOrder, sortedIds);
  const tiles = tileData(categories, items, status);
  const byId = new Map(tiles.map((tile) => [tile.category.id, tile]));
  const [dragId, setDragId] = useState<string | null>(null);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const [moveMenu, setMoveMenu] = useState<{
    id: string;
    anchor: DOMRect;
    trigger: HTMLElement;
  } | null>(null);
  const drag = useRef<Drag | null>(null);
  const offsetRef = useRef({ x: 0, y: 0 });
  const tileRefs = useRef(new Map<string, HTMLElement>());
  const rootRef = useRef<HTMLDivElement>(null);
  const doneRef = useRef<HTMLButtonElement>(null);
  const suppressClick = useRef(false);

  // Modo de ordem = Realtime pausado (um refresh no meio do arrastar
  // bagunçaria a ordem); ao sair, atualiza uma vez se chegou algo.
  useEffect(() => {
    if (!rootRef.current) return;
    return holdWhileOpen(rootRef.current);
  }, []);

  useEffect(() => {
    const target = focusId ? tileRefs.current.get(focusId) : null;
    (target ?? doneRef.current)?.focus({ preventScroll: true });
    // Só ao entrar no modo.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // O quadrado arrastado segue o dedo: desconta o lugar novo dele na grade.
  function syncOffset() {
    const current = drag.current;
    const element = current ? tileRefs.current.get(current.id) : null;
    if (!current || !element) return;
    const rect = element.getBoundingClientRect();
    const baseLeft = rect.left - offsetRef.current.x;
    const baseTop = rect.top - offsetRef.current.y;
    const next = { x: current.x - current.grabX - baseLeft, y: current.y - current.grabY - baseTop };
    offsetRef.current = next;
    setOffset(next);
  }

  useLayoutEffect(() => {
    if (drag.current) syncOffset();
    // Depois que a ordem mudou no meio do arrastar.
  }, [localOrder]);

  function save(next: string[]) {
    setLocalOrder(next);
    void onMove(next);
  }

  function onPointerDown(id: string, event: ReactPointerEvent<HTMLElement>) {
    if (event.button !== 0) return;
    // No toque, só a alça arrasta (o resto do quadrado deixa rolar a tela).
    if (
      event.pointerType !== "mouse" &&
      !(event.target as HTMLElement).closest("[data-reorder-handle]")
    ) {
      return;
    }
    const element = event.currentTarget;
    const rect = element.getBoundingClientRect();
    element.setPointerCapture(event.pointerId);
    drag.current = {
      id,
      pointerId: event.pointerId,
      startOrder: order,
      grabX: event.clientX - rect.left,
      grabY: event.clientY - rect.top,
      x: event.clientX,
      y: event.clientY,
      moved: false,
    };
    offsetRef.current = { x: 0, y: 0 };
    setOffset({ x: 0, y: 0 });
    setDragId(id);
  }

  function onPointerMove(event: ReactPointerEvent<HTMLElement>) {
    const current = drag.current;
    if (!current || current.pointerId !== event.pointerId) return;
    event.preventDefault();
    current.x = event.clientX;
    current.y = event.clientY;
    if (Math.hypot(offsetRef.current.x, offsetRef.current.y) > 4) current.moved = true;

    // Em cima de outro quadrado: o arrastado vai para o lugar dele.
    for (const [otherId, element] of tileRefs.current) {
      if (otherId === current.id) continue;
      const rect = element.getBoundingClientRect();
      if (
        event.clientX >= rect.left &&
        event.clientX <= rect.right &&
        event.clientY >= rect.top &&
        event.clientY <= rect.bottom
      ) {
        setLocalOrder((previous) => {
          const base = mergeOrder(previous, sortedIds);
          return moveCategoryTo(base, current.id, base.indexOf(otherId));
        });
        current.moved = true;
        break;
      }
    }

    if (event.clientY < AUTO_SCROLL_EDGE) window.scrollBy(0, -AUTO_SCROLL_STEP);
    else if (event.clientY > window.innerHeight - AUTO_SCROLL_EDGE) {
      window.scrollBy(0, AUTO_SCROLL_STEP);
    }
    syncOffset();
  }

  function endDrag(event: ReactPointerEvent<HTMLElement>, cancelled: boolean) {
    const current = drag.current;
    if (!current || current.pointerId !== event.pointerId) return;
    drag.current = null;
    setDragId(null);
    offsetRef.current = { x: 0, y: 0 };
    setOffset({ x: 0, y: 0 });
    if (cancelled) {
      setLocalOrder(current.startOrder);
      return;
    }
    if (!sameOrder(order, current.startOrder)) void onMove(order);
    // Arrastou: o clique que vem depois não abre o menu de mover.
    if (current.moved) suppressClick.current = true;
  }

  const menuTile = moveMenu ? byId.get(moveMenu.id) : null;
  const moveOptions = moveMenu ? categoryMoveOptions(order, moveMenu.id) : null;

  return (
    <div ref={rootRef} className="space-y-3.5">
      <div className="sticky top-2 z-20 flex h-12 items-center justify-between gap-3 rounded-[14px] bg-cream pl-3.5 pr-1.5 text-ink shadow-[0_10px_24px_rgba(0,0,0,0.3)] lg:max-w-xl">
        <p className="text-[15px] font-semibold">{CATEGORY_MENU_COPY.reorderBar}</p>
        <button
          ref={doneRef}
          type="button"
          onClick={onDone}
          className="flex h-9 items-center rounded-xl bg-accent px-4 text-[15px] font-semibold text-accent-contrast transition hover:brightness-110"
        >
          {CATEGORY_MENU_COPY.reorderDone}
        </button>
      </div>

      <ul className="grid grid-cols-2 gap-2.5 md:grid-cols-3 md:gap-3.5 lg:grid-cols-4 xl:grid-cols-5">
        {/* Recentes ficam sempre primeiro: no modo de ordem, só de fundo. */}
        <li inert className="opacity-40">
          <RecentTile items={items} status={status} />
        </li>
        {order.map((id) => {
          const tile = byId.get(id);
          if (!tile) return null;
          const { category, count, sampleText, average } = tile;
          const dragging = dragId === id;
          return (
            <li key={id} className={dragging ? "relative z-30" : "relative"}>
              <button
                ref={(element) => {
                  if (element) tileRefs.current.set(id, element);
                  else tileRefs.current.delete(id);
                }}
                type="button"
                aria-haspopup="menu"
                aria-label={CATEGORY_MENU_COPY.reorderHandle(category.name)}
                onPointerDown={(event) => onPointerDown(id, event)}
                onPointerMove={onPointerMove}
                onPointerUp={(event) => endDrag(event, false)}
                onPointerCancel={(event) => endDrag(event, true)}
                onContextMenu={(event) => event.preventDefault()}
                onClick={(event) => {
                  if (suppressClick.current) {
                    suppressClick.current = false;
                    return;
                  }
                  setMoveMenu({
                    id,
                    anchor: event.currentTarget.getBoundingClientRect(),
                    trigger: event.currentTarget,
                  });
                }}
                style={
                  dragging
                    ? { transform: `translate(${offset.x}px, ${offset.y}px) scale(1.04)` }
                    : undefined
                }
                className={`${TILE_BASE} text-white ${category.color} ${NO_CALLOUT} ${
                  dragging
                    ? "cursor-grabbing shadow-[0_24px_50px_rgba(0,0,0,0.6)]"
                    : "cursor-grab transition-transform"
                }`}
              >
                <CategoryTileFace
                  emoji={category.emoji}
                  name={category.name}
                  count={count}
                  sample={sampleText}
                  sampleLines={average ? 1 : 2}
                  extra={average ? <AverageLine average={average} /> : null}
                  corner={
                    <span
                      aria-hidden="true"
                      data-reorder-handle
                      className="-m-1.5 flex h-11 w-11 touch-none items-center justify-center rounded-full bg-[rgba(10,14,26,0.35)] text-[22px] font-bold leading-none text-white"
                    >
                      ↕
                    </span>
                  }
                />
              </button>
            </li>
          );
        })}
      </ul>

      {moveMenu && menuTile && moveOptions ? (
        <AnchoredMenu
          label={CATEGORY_MENU_COPY.reorderHandle(menuTile.category.name)}
          anchor={moveMenu.anchor}
          entries={[
            ...(moveOptions.up
              ? [
                  {
                    key: "up",
                    emoji: "⬆️",
                    label: CATEGORY_MENU_COPY.moveUp,
                    onSelect: () => {
                      setMoveMenu(null);
                      save(moveCategory(order, moveMenu.id, "up"));
                    },
                  },
                ]
              : []),
            ...(moveOptions.down
              ? [
                  {
                    key: "down",
                    emoji: "⬇️",
                    label: CATEGORY_MENU_COPY.moveDown,
                    onSelect: () => {
                      setMoveMenu(null);
                      save(moveCategory(order, moveMenu.id, "down"));
                    },
                  },
                ]
              : []),
          ]}
          footer={CATEGORY_MENU_COPY.footer}
          returnFocus={moveMenu.trigger}
          onClose={() => setMoveMenu(null)}
        />
      ) : null}
    </div>
  );
}
