"use client";

import { useState, type ReactNode } from "react";

import {
  ItemList,
  ListScreenHeader,
  type ItemListProps,
} from "@/components/item-list";
import { Pressable, ScoreBadge } from "@/components/item-visuals";
import { Toast, useToast } from "@/components/toast";
import {
  LIST_COPY,
  VIEW_COPY,
  viewToast,
  type ItemSort,
  type ScoreAverage,
} from "@/lib/categories";
import type { ItemView } from "@/lib/types";

// Link (app) ou callback (demo), como no Pressable.
type Action = { href?: string; onClick?: () => void };

// O toast da troca some em 3 s (C11).
const VIEW_TOAST_MS = 3000;

const VIEWS: ItemView[] = ["grid", "compact"];
const SORTS: ItemSort[] = ["score", "recent"];
const SORT_LABELS: Record<ItemSort, string> = {
  score: LIST_COPY.sortScore,
  recent: LIST_COPY.sortRecent,
};

export type ItemsScreenProps = Pick<
  ItemListProps,
  "items" | "categoriesById" | "memberNames" | "memberOrder" | "onOpen" | "imagesById"
> & {
  backLabel: string;
  back: Action;
  title: string;
  // "· n" no título (na categoria; os recentes não têm).
  count?: number;
  // Grade/Compacta salva da pessoa (profiles.item_view ou localStorage na demo).
  initialView: ItemView;
  // Grava a escolha. A tela já trocou antes (otimista); falha não volta atrás.
  onViewChange?: (view: ItemView) => unknown;
  // Nome do par para o toast; sem par, só a 1ª linha.
  partnerName: string | null;
  // "Ordenar: Melhor nota · Mais recentes" (C10). Sem isso, "Mais recentes primeiro".
  sort?: { value: ItemSort; options: Record<ItemSort, Action> } | null;
  // Selo da média ao lado do título (C13).
  average?: ScoreAverage | null;
  // "＋ Adicionar em {nome}": quadrado no fim da Grade (só se tile) e link da
  // categoria vazia.
  add?: (Action & { name: string; tile: boolean }) | null;
  // "···" (menu 55 da categoria), ao lado do seletor. Os recentes não têm.
  options?: ReactNode;
};

// Dentro da categoria (52/53) e "Adicionados recentemente": cabeçalho,
// seletor Grade/Compacta, a lista e o toast. Mesmo componente no app e na demo.
export function ItemsScreen({
  backLabel,
  back,
  title,
  count,
  initialView,
  onViewChange,
  partnerName,
  sort,
  average,
  add,
  options,
  items,
  ...listProps
}: ItemsScreenProps) {
  const [view, setView] = useState<ItemView>(initialView);
  const [toast, showToast] = useToast(VIEW_TOAST_MS);
  const toastText = viewToast(partnerName);

  function chooseView(next: ItemView) {
    if (next === view) return;
    setView(next);
    showToast(toastText.title);
    // Só grava; a tela não espera nem recarrega.
    void Promise.resolve(onViewChange?.(next)).catch(() => undefined);
  }

  return (
    <>
      <ListScreenHeader
        backLabel={backLabel}
        backHref={back.href}
        onBack={back.onClick}
        title={title}
        count={count}
        right={
          <div className="flex items-center gap-2">
            <ViewSwitch view={view} onChange={chooseView} />
            {options}
          </div>
        }
        titleAside={average ? <AverageAside average={average} /> : null}
        subtitle={
          sort ? <SortControl sort={sort} /> : LIST_COPY.newestFirst
        }
      />

      <div className="mt-3">
        {items.length === 0 ? (
          <div className="py-6 text-center text-[15px] text-cream/70">
            <p>{LIST_COPY.empty}</p>
            {add ? (
              <Pressable
                href={add.href}
                onClick={add.onClick}
                className="mt-2 inline-flex min-h-11 items-center font-semibold text-cream underline decoration-cream/40 underline-offset-4 transition hover:decoration-cream"
              >
                {LIST_COPY.addIn(add.name)}
              </Pressable>
            ) : null}
          </div>
        ) : (
          <ItemList
            items={items}
            view={view}
            addTile={
              add?.tile
                ? { label: LIST_COPY.addIn(add.name), href: add.href, onClick: add.onClick }
                : null
            }
            {...listProps}
          />
        )}
      </div>

      {toast ? (
        <Toast check title={toastText.title} description={toastText.description} />
      ) : null}
    </>
  );
}

// Seletor de 2 ícones; o nome aparece só no ativo (mockups 52/53).
function ViewSwitch({
  view,
  onChange,
}: {
  view: ItemView;
  onChange: (view: ItemView) => void;
}) {
  return (
    <div className="flex shrink-0 gap-0.5 rounded-xl bg-cream/[0.12] p-[3px]">
      {VIEWS.map((option) => {
        const active = option === view;
        return (
          <button
            key={option}
            type="button"
            aria-label={VIEW_COPY[option].ariaLabel}
            aria-pressed={active}
            onClick={() => onChange(option)}
            className={`flex h-[30px] min-w-[34px] items-center justify-center gap-1.5 rounded-[9px] px-2 text-[13.5px] font-bold transition ${
              active ? "bg-cream text-ink" : "text-cream/75 hover:text-cream"
            }`}
          >
            <ViewIcon view={option} />
            {active ? <span aria-hidden="true">{VIEW_COPY[option].label}</span> : null}
          </button>
        );
      })}
    </div>
  );
}

function ViewIcon({ view }: { view: ItemView }) {
  return view === "grid" ? (
    <svg aria-hidden="true" viewBox="0 0 24 24" className="h-[18px] w-[18px]" fill="none" stroke="currentColor" strokeWidth="2">
      <rect x="3.5" y="3.5" width="7" height="7" rx="1.8" />
      <rect x="13.5" y="3.5" width="7" height="7" rx="1.8" />
      <rect x="3.5" y="13.5" width="7" height="7" rx="1.8" />
      <rect x="13.5" y="13.5" width="7" height="7" rx="1.8" />
    </svg>
  ) : (
    <svg aria-hidden="true" viewBox="0 0 24 24" className="h-[18px] w-[18px]" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
      <path d="M9 6h12M9 12h12M9 18h12" />
      <circle cx="4.5" cy="6" r="1.2" fill="currentColor" />
      <circle cx="4.5" cy="12" r="1.2" fill="currentColor" />
      <circle cx="4.5" cy="18" r="1.2" fill="currentColor" />
    </svg>
  );
}

// "Ordenar: Melhor nota · Mais recentes" (C10); a escolha fica na URL.
function SortControl({
  sort,
}: {
  sort: NonNullable<ItemsScreenProps["sort"]>;
}) {
  return (
    <div
      role="group"
      aria-label={LIST_COPY.sortLabel.replace(/:$/, "")}
      className="flex items-center gap-1 whitespace-nowrap"
    >
      <span aria-hidden="true">{LIST_COPY.sortLabel}</span>
      {SORTS.map((option) => {
        const active = option === sort.value;
        return (
          <Pressable
            key={option}
            href={sort.options[option].href}
            onClick={sort.options[option].onClick}
            aria-current={active ? "true" : undefined}
            className={`rounded-full py-[3px] transition ${
              active
                ? "bg-cream/[0.14] px-[9px] font-bold text-cream"
                : "px-1.5 hover:text-cream"
            }`}
          >
            {SORT_LABELS[option]}
          </Pressable>
        );
      })}
    </div>
  );
}

// Selo "{x,x}" e "média · {n} notas" à direita do título (mockup 53).
function AverageAside({ average }: { average: ScoreAverage }) {
  return (
    <div className="shrink-0 text-right leading-[1.2]">
      <ScoreBadge
        value={average.value}
        className="rounded-[9px] px-[9px] py-[3px] text-[15px]"
      />
      <p className="mt-[3px] whitespace-nowrap text-[11.5px] text-cream/60">
        {LIST_COPY.scoreAverage(average.count)}
      </p>
    </div>
  );
}
