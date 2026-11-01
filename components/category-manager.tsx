"use client";

import { useState, type ReactNode } from "react";

import {
  CategoryBlockedSheet,
  CategoryDeleteSheet,
  CategorySheet,
} from "@/components/category-sheets";
import { AnchoredMenu, type MenuEntry } from "@/components/overlay";
import { Toast, useToast } from "@/components/toast";
import {
  CATEGORY_MENU_COPY,
  CATEGORY_SHEET_COPY,
  CATEGORY_UNKNOWN_ERROR,
  deleteDecision,
  seeItemsStatus,
  validateCategoryInput,
  type CategoryCounts,
  type CategoryInput,
} from "@/lib/categories";
import type { Category, ItemStatus } from "@/lib/types";

export type ManagedCategory = Pick<
  Category,
  "id" | "name" | "emoji" | "color" | "position" | "item_type" | "created_at"
>;

// O que muda de verdade: server actions no app, o store em memória na demo.
// Erro esperado volta como resultado (sem throw).
export type CategoryApi = {
  create(input: CategoryInput): Promise<{ ok: true; id: string } | { ok: false; error: string }>;
  update(
    id: string,
    input: CategoryInput,
  ): Promise<{ ok: true; id: string } | { ok: false; error: string }>;
  move(orderedIds: string[]): Promise<{ ok: boolean }>;
  count(id: string): Promise<({ ok: true } & CategoryCounts) | { ok: false }>;
  remove(
    id: string,
  ): Promise<
    | { ok: true }
    | ({ ok: false; reason: "not_empty" } & CategoryCounts)
    | { ok: false; reason: "unknown" }
  >;
};

// Número e amostra do quadrado (prévia da folha ao editar).
export type TilePreview = { count: number; sample: string };

type Overlay =
  | { kind: "none" }
  | { kind: "menu"; category: ManagedCategory; anchor: DOMRect; preview?: TilePreview }
  | {
      kind: "sheet";
      category: ManagedCategory | null;
      focus: "name" | "emoji";
      preview?: TilePreview;
    }
  | { kind: "blocked"; category: ManagedCategory; counts: CategoryCounts }
  | { kind: "confirm"; category: ManagedCategory };

const TOAST_MS = 4000;

/**
 * Menu 55, folha 54 (criar/editar), 55b/55c e o toast. O início e a tela da
 * categoria ("···") usam o mesmo, no app e na demo. Devolve as ações e o
 * `element` para renderizar.
 */
export function useCategoryManager({
  categories,
  api,
  onReorder,
  onSeeItems,
  onDeleted,
}: {
  categories: readonly ManagedCategory[];
  api: CategoryApi;
  // "Mudar ordem": no início, liga o modo de ordem; na categoria, vai ao início.
  onReorder: (category: ManagedCategory) => void;
  // 55b "Ver os itens".
  onSeeItems: (category: ManagedCategory, status: ItemStatus) => void;
  // Depois de apagar (na categoria aberta: volta ao início). Sem isso, toast aqui.
  onDeleted?: (category: ManagedCategory) => void;
}) {
  const [overlay, setOverlay] = useState<Overlay>({ kind: "none" });
  const [toast, showToast] = useToast(TOAST_MS);

  const close = () => setOverlay({ kind: "none" });

  function openMenu(category: ManagedCategory, anchor: Element, preview?: TilePreview) {
    setOverlay({ kind: "menu", category, anchor: anchor.getBoundingClientRect(), preview });
  }

  function openCreate() {
    setOverlay({ kind: "sheet", category: null, focus: "name" });
  }

  async function startDelete(category: ManagedCategory) {
    close();
    const counts = await api.count(category.id);
    if (!counts.ok) {
      showToast(CATEGORY_UNKNOWN_ERROR);
      return;
    }
    setOverlay(
      deleteDecision(counts) === "blocked"
        ? { kind: "blocked", category, counts: { want: counts.want, done: counts.done } }
        : { kind: "confirm", category },
    );
  }

  function menuEntries(category: ManagedCategory, preview?: TilePreview): MenuEntry[] {
    const { rename, restyle, reorder, remove } = CATEGORY_MENU_COPY;
    return [
      {
        key: "rename",
        ...rename,
        onSelect: () => setOverlay({ kind: "sheet", category, focus: "name", preview }),
      },
      {
        key: "restyle",
        ...restyle,
        onSelect: () => setOverlay({ kind: "sheet", category, focus: "emoji", preview }),
      },
      {
        key: "reorder",
        ...reorder,
        onSelect: () => {
          close();
          onReorder(category);
        },
      },
      {
        key: "remove",
        ...remove,
        danger: true,
        onSelect: () => void startDelete(category),
      },
    ];
  }

  let element: ReactNode = null;
  if (overlay.kind === "menu") {
    element = (
      <AnchoredMenu
        label={CATEGORY_MENU_COPY.options}
        anchor={overlay.anchor}
        entries={menuEntries(overlay.category, overlay.preview)}
        footer={CATEGORY_MENU_COPY.footer}
        onClose={close}
      />
    );
  } else if (overlay.kind === "sheet") {
    const editing = overlay.category;
    element = (
      <CategorySheet
        key={editing?.id ?? "new"}
        category={editing}
        focus={overlay.focus}
        preview={overlay.preview}
        validate={(input) =>
          validateCategoryInput(input, categories, editing ? { editingId: editing.id } : {})
        }
        onSubmit={async (input) => {
          const result = editing
            ? await api.update(editing.id, input)
            : await api.create(input);
          if (!result.ok) return result.error;
          close();
          showToast(editing ? CATEGORY_SHEET_COPY.saved : CATEGORY_SHEET_COPY.created);
          return null;
        }}
        onClose={close}
      />
    );
  } else if (overlay.kind === "blocked") {
    const { category, counts } = overlay;
    element = (
      <CategoryBlockedSheet
        category={category}
        counts={counts}
        onSeeItems={() => {
          close();
          onSeeItems(category, seeItemsStatus(counts));
        }}
        onClose={close}
      />
    );
  } else if (overlay.kind === "confirm") {
    const { category } = overlay;
    element = (
      <CategoryDeleteSheet
        category={category}
        onConfirm={async () => {
          const result = await api.remove(category.id);
          // No app, apagar de dentro da categoria já navega (redirect da action).
          if (!result) return null;
          if (result.ok) {
            close();
            if (onDeleted) onDeleted(category);
            else showToast(CATEGORY_SHEET_COPY.deleted);
            return null;
          }
          if (result.reason === "not_empty") {
            // Corrida (o par adicionou algo agora): 55b com os números novos.
            setOverlay({
              kind: "blocked",
              category,
              counts: { want: result.want, done: result.done },
            });
            return null;
          }
          return CATEGORY_UNKNOWN_ERROR;
        }}
        onClose={close}
      />
    );
  }

  return {
    openMenu,
    openCreate,
    notify: showToast,
    // Quadrado "levantado" sobre a tela escurecida (mockup 55).
    menuCategoryId: overlay.kind === "menu" ? overlay.category.id : null,
    element: (
      <>
        {element}
        {toast ? (
          <Toast check={toast !== CATEGORY_UNKNOWN_ERROR} title={toast} />
        ) : null}
      </>
    ),
  };
}

// "···" no cabeçalho da categoria (52/53): o mesmo menu 55 do quadrado.
export function CategoryOptionsButton({
  category,
  preview,
  ...options
}: {
  category: ManagedCategory;
  preview?: TilePreview;
} & Parameters<typeof useCategoryManager>[0]) {
  const manager = useCategoryManager(options);

  return (
    <>
      <button
        type="button"
        aria-label={CATEGORY_MENU_COPY.options}
        aria-haspopup="menu"
        aria-expanded={manager.menuCategoryId === category.id}
        onClick={(event) => manager.openMenu(category, event.currentTarget, preview)}
        className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-cream/[0.12] text-lg font-bold leading-none text-cream/80 transition hover:text-cream"
      >
        <span aria-hidden="true">···</span>
      </button>
      {manager.element}
    </>
  );
}
