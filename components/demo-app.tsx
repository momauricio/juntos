"use client";

import { useEffect, useRef, useState } from "react";

import { STATUS_LABELS } from "@/lib/labels";
import {
  assertScore,
  coupleScore,
  parseScore,
  personAverage,
  scoreInputValue,
} from "@/lib/ratings";
import { addedByLabel } from "@/lib/relative-time";
import { ratingSavedMessage } from "@/lib/demo/after-rating";
import {
  CATEGORY_SHEET_COPY,
  categoryItems,
  categorySampleText,
  categoryScoreAverage,
  categoryTitle,
  LIST_COPY,
  recentItems,
  showsScoreSort,
  type ItemSort,
} from "@/lib/categories";
import { countByStatus } from "@/lib/item-categories";
import type { Category, ItemStatus, ItemView } from "@/lib/types";
import {
  addItem,
  clearDemoCategories,
  countDemoCategoryItems,
  createDemoCategory,
  createTrip,
  deleteDemoCategory,
  demoCategories,
  demoItemImages,
  itemsWithRatings,
  loadDemoCategories,
  loadItemView,
  loadState,
  memberName,
  moveDemoCategories,
  reconcileItemCategories,
  sampleState,
  saveDemoCategories,
  saveItemView,
  saveState,
  setItemCategory,
  updateDemoCategory,
  upsertRating,
  type DemoSpace,
  type DemoState,
  type DemoUser,
} from "@/lib/demo/store";
import { memberTone } from "@/components/avatar";
import { CategoryField } from "@/components/category-field";
import { CategoryHome, type HomeTarget } from "@/components/category-home";
import {
  CategoryOptionsButton,
  type CategoryApi,
  type ManagedCategory,
} from "@/components/category-manager";
import { Toast, useToast } from "@/components/toast";
import { DemoHub } from "@/components/demo-hub";
import { StatusTabs } from "@/components/item-filters";
import { ItemsScreen } from "@/components/items-screen";
import {
  ActivityNoAddressNote,
  heroBadge,
  heroCategoryLabel,
  heroSubtitle,
  ItemHero,
  CoupleScoreCard,
  EditDisclosure,
  ratingChips,
} from "@/components/item-visuals";
import { SpaceHeader, TopNav } from "@/components/space-header";
import {
  BACK_LINK,
  BTN_OUTLINE,
  BTN_PRIMARY,
  BTN_SOFT,
  CARD,
  FAB,
} from "@/components/ui-classes";
import { DemoShowcaseBanner } from "@/components/demo-showcase-banner";
import { IdeaWizard } from "@/components/demo-idea-wizard";
import { TripWizard } from "@/components/demo-trip-wizard";
import { TripDetail, TripsHome } from "@/components/demo-trips";
import { ScoreInput } from "@/components/rating-form";

type Screen =
  | { name: "hub" }
  // reorder: abre no modo de ordem ("Mudar ordem" no "···" da categoria).
  | { name: "ideas"; reorder?: boolean }
  | { name: "idea-wizard"; categoryId?: string; from?: ListScreen }
  | { name: "category"; categoryId: string; sort?: ItemSort }
  | { name: "recent" }
  | { name: "detail"; itemId: string; from: ListScreen }
  | { name: "trips" }
  | { name: "trip-new" }
  | { name: "trip-detail"; tripId: string }
  | { name: "settings" };

// Telas de onde o detalhe abre (o "← voltar" do detalhe volta para ela).
type ListScreen =
  | { name: "ideas" }
  | { name: "category"; categoryId: string; sort?: ItemSort }
  | { name: "recent" };

type MessageAction = { forMessage: string; label: string; onClick: () => void };

export function DemoApp() {
  const [state, setState] = useState<DemoState | null>(null);
  const [screen, setScreen] = useState<Screen>({ name: "hub" });
  const [message, setMessage] = useState<string | null>(null);
  const [messageAction, setMessageAction] = useState<MessageAction | null>(null);
  const [statusFilter, setStatusFilter] = useState<ItemStatus>("want");
  // Grade/Compacta de quem usa a demo (C11), no localStorage da demo.
  const [itemView, setItemView] = useState<ItemView>("grid");
  // Categorias da sessão (C16): as 8 padrão + o que o casal mudou nesta aba.
  const [categories, setCategories] = useState<Category[]>([]);
  // Toast de categoria que sobrevive à troca de tela (apagar de dentro dela).
  const [categoryToast, showCategoryToast] = useToast();
  // O mais recente para as ações assíncronas da folha/menu.
  const latest = useRef<{ state: DemoState | null; categories: Category[] }>({
    state: null,
    categories: [],
  });
  useEffect(() => {
    latest.current = { state, categories };
  });

  useEffect(() => {
    // localStorage só existe no cliente; o primeiro render é o do servidor.
    const loaded = loadState();
    const sessionCategories = loadDemoCategories(loaded.space.id);
    setCategories(sessionCategories);
    setState({
      ...loaded,
      space: reconcileItemCategories(loaded.space, sessionCategories),
    });
    setItemView(loadItemView());
  }, []);

  function persist(next: DemoState) {
    setState(next);
    saveState(next);
  }

  function persistCategories(next: Category[]) {
    setCategories(next);
    saveDemoCategories(next);
  }

  // Mesmas regras do app, sem banco (lib/demo/store.ts).
  const categoryApi: CategoryApi = {
    create: async (input) => {
      const current = latest.current.state;
      if (!current) return { ok: false, error: "" };
      const result = createDemoCategory(latest.current.categories, input, {
        spaceId: current.space.id,
        userId: current.user.id,
      });
      if (!result.ok) return result;
      persistCategories(result.categories);
      return { ok: true, id: result.category.id };
    },
    update: async (id, input) => {
      const result = updateDemoCategory(latest.current.categories, id, input);
      if (!result.ok) return result;
      persistCategories(result.categories);
      return { ok: true, id };
    },
    move: async (ids) => {
      persistCategories(moveDemoCategories(latest.current.categories, ids));
      return { ok: true };
    },
    count: async (id) => {
      const current = latest.current.state;
      if (!current) return { ok: false };
      return { ok: true, ...countDemoCategoryItems(current.space, id) };
    },
    remove: async (id) => {
      const current = latest.current.state;
      if (!current) return { ok: false, reason: "unknown" };
      const result = deleteDemoCategory(latest.current.categories, current.space, id);
      if (!result.ok) return result;
      persistCategories(result.categories);
      return { ok: true };
    },
  };

  function seeItems(category: ManagedCategory, status: ItemStatus) {
    setStatusFilter(status);
    setScreen({ name: "category", categoryId: category.id });
  }

  if (!state) {
    return (
      <div className="mx-auto flex min-h-dvh w-full max-w-lg flex-col md:max-w-3xl lg:max-w-6xl">
        <DemoShowcaseBanner />
        <main className="flex flex-1 items-center justify-center px-4">
          <p className="text-sm text-cream/70">Carregando Juntos…</p>
        </main>
      </div>
    );
  }

  const space = state.space;
  const user = state.user;

  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-lg flex-col md:max-w-3xl lg:max-w-6xl">
      <DemoShowcaseBanner />
      {message ? (
        <div role="status" className="mx-4 mt-4 rounded-[18px] md:mx-auto md:w-full md:max-w-md bg-cream px-3.5 py-3 text-[15px] font-semibold text-ink shadow-[0_14px_30px_rgba(0,0,0,0.35)]">
          <div className="flex items-center justify-between gap-3">
            <span>{message}</span>
            {messageAction && messageAction.forMessage === message ? (
              <button
                type="button"
                className="shrink-0 rounded-lg px-2 py-1 font-medium underline"
                onClick={() => {
                  messageAction.onClick();
                  setMessageAction(null);
                }}
              >
                {messageAction.label}
              </button>
            ) : null}
          </div>
        </div>
      ) : null}

      <main className={`flex-1 px-5 pb-10 pt-4 ${mainWidth(screen.name)}`}>
        {screen.name === "hub" ? (
          <DemoHub
            onIdea={() => setScreen({ name: "idea-wizard" })}
            onTrip={() => setScreen({ name: "trip-new" })}
            onSeeIdeas={() => setScreen({ name: "ideas" })}
            onSeeTrips={() => setScreen({ name: "trips" })}
            onSettings={() => setScreen({ name: "settings" })}
          />
        ) : null}

        {screen.name === "ideas" ? (
          <Home
            key={screen.reorder ? "reorder" : "home"}
            space={space}
            categories={categories}
            status={statusFilter}
            onStatusChange={setStatusFilter}
            onOpen={(target) => {
              if (target.kind === "item") {
                setScreen({ name: "detail", itemId: target.id, from: { name: "ideas" } });
              } else if (target.kind === "category") {
                setScreen({ name: "category", categoryId: target.id });
              } else {
                setScreen({ name: "recent" });
              }
            }}
            onNewIdea={() => setScreen({ name: "idea-wizard" })}
            onSettings={() => setScreen({ name: "settings" })}
            manage={{
              api: categoryApi,
              onSeeItems: seeItems,
              initialReorder: screen.reorder,
              onReorderEnd: () => setScreen({ name: "ideas" }),
            }}
          />
        ) : null}

        {screen.name === "category" || screen.name === "recent" ? (
          <DemoItemsScreen
            // Uma tela nova por categoria/aba: a visualização começa na salva.
            key={`${screen.name === "category" ? screen.categoryId : "recent"}-${statusFilter}`}
            space={space}
            user={user}
            categories={categories}
            status={statusFilter}
            categoryId={screen.name === "category" ? screen.categoryId : null}
            sort={screen.name === "category" ? (screen.sort ?? "recent") : "recent"}
            view={itemView}
            onViewChange={(view) => {
              setItemView(view);
              saveItemView(view);
            }}
            onSortChange={(sort) =>
              screen.name === "category" && setScreen({ ...screen, sort })
            }
            onBack={() => setScreen({ name: "ideas" })}
            onAdd={(categoryId) =>
              setScreen({ name: "idea-wizard", categoryId, from: screen })
            }
            options={(category, preview) => (
              <CategoryOptionsButton
                category={category}
                preview={preview}
                categories={categories}
                api={categoryApi}
                onReorder={() => setScreen({ name: "ideas", reorder: true })}
                onSeeItems={seeItems}
                onDeleted={() => {
                  setScreen({ name: "ideas" });
                  showCategoryToast(CATEGORY_SHEET_COPY.deleted);
                }}
              />
            )}
            onOpen={(itemId) =>
              setScreen({ name: "detail", itemId, from: screen })
            }
          />
        ) : null}

        {screen.name === "idea-wizard" ? (
          <IdeaWizard
            categories={categories}
            initialCategoryId={screen.categoryId}
            onCancel={() => setScreen(screen.from ?? { name: "hub" })}
            onSave={({ category, title, url }) => {
              // O type do item novo sai da categoria (C4: as do casal são 'activity').
              const nextSpace = addItem(space, {
                type: category.item_type,
                categoryId: category.id,
                title,
                url,
                createdBy: user.id,
              });
              persist({ user, space: nextSpace });
              setScreen(screen.from ?? { name: "hub" });
              setMessage("Ideia salva neste aparelho.");
            }}
          />
        ) : null}

        {screen.name === "detail" ? (
          <Detail
            space={space}
            itemId={screen.itemId}
            categories={categories}
            user={user}
            onBack={() => setScreen(screen.from)}
            onMoveCategory={(categoryId) => {
              persist({ user, space: setItemCategory(space, screen.itemId, categoryId) });
              setMessage("Ideia salva neste aparelho.");
            }}
            onRate={(payload) => {
              try {
                if (payload.score != null) assertScore(payload.score);
                if (payload.food != null) assertScore(payload.food);
                if (payload.service != null) assertScore(payload.service);
                if (payload.ambiance != null) assertScore(payload.ambiance);
                const item = space.items.find((i) => i.id === screen.itemId);
                const wasWant = item?.status === "want";
                const nextSpace = upsertRating(space, {
                  itemId: screen.itemId,
                  ratedBy: user.id,
                  ...payload,
                });
                persist({ user, space: nextSpace });
                if (item) {
                  // Item com nota fica em "Já fizemos": troca a aba para ele seguir visível.
                  setStatusFilter("done");
                }
                const text = ratingSavedMessage(item?.title ?? "", wasWant);
                setMessage(text);
                setMessageAction(wasWant ? { forMessage: text, label: "Ver Queremos", onClick: () => setStatusFilter("want") } : null);
                setScreen(screen.from);
              } catch (error) {
                setMessage(
                  error instanceof Error ? error.message : "Não foi possível salvar a nota.",
                );
              }
            }}
          />
        ) : null}

        {screen.name === "trips" ? (
          <TripsHome
            space={space}
            onOpen={(tripId) => setScreen({ name: "trip-detail", tripId })}
            onNew={() => setScreen({ name: "trip-new" })}
            onBack={() => setScreen({ name: "hub" })}
          />
        ) : null}

        {screen.name === "trip-new" ? (
          <TripWizard
            onCancel={() => setScreen({ name: "hub" })}
            onSave={(input) => {
              const nextSpace = createTrip(space, input);
              persist({ user, space: nextSpace });
              const tripId = nextSpace.trips[0]?.id;
              setMessage("Viagem criada.");
              setScreen(
                tripId
                  ? { name: "trip-detail", tripId }
                  : { name: "trips" },
              );
            }}
          />
        ) : null}

        {screen.name === "trip-detail" ? (
          (() => {
            const trip = space.trips.find((t) => t.id === screen.tripId);
            if (!trip) {
              return (
                <div className="space-y-3">
                  <p className="text-sm text-cream">Viagem não encontrada.</p>
                  <button
                    type="button"
                    className="text-sm text-cream underline"
                    onClick={() => setScreen({ name: "trips" })}
                  >
                    Voltar
                  </button>
                </div>
              );
            }
            return (
              <TripDetail
                trip={trip}
                members={space.members}
                onBack={() => setScreen({ name: "trips" })}
                onChange={(updater) => {
                  persist({ user, space: updater(space) });
                }}
              />
            );
          })()
        ) : null}

        {screen.name === "settings" ? (
          <Settings
            space={space}
            user={user}
            onBack={() => setScreen({ name: "hub" })}
            onReset={() => {
              const sample = sampleState();
              clearDemoCategories();
              persistCategories(demoCategories(sample.space.id));
              persist(sample);
              setScreen({ name: "hub" });
              setMessage("Dados de exemplo restaurados.");
            }}
          />
        ) : null}
      </main>
      {categoryToast ? <Toast check title={categoryToast} /> : null}
    </div>
  );
}

// Largura da tela a partir de md: listas usam o container largo inteiro; o
// hub fica médio (2 cartões lado a lado em lg) e o resto vira coluna de leitura.
function mainWidth(name: Screen["name"]) {
  if (name === "ideas" || name === "category" || name === "recent") return "md:w-full";
  if (name === "hub") return "md:mx-auto md:w-full md:max-w-4xl";
  return "md:mx-auto md:w-full md:max-w-[44.5rem] lg:pt-8";
}

function Home({
  space,
  categories,
  status,
  onStatusChange,
  onOpen,
  onNewIdea,
  onSettings,
  manage,
}: {
  space: DemoSpace;
  categories: Category[];
  status: ItemStatus;
  onStatusChange: (status: ItemStatus) => void;
  onOpen: (target: HomeTarget) => void;
  onNewIdea: () => void;
  onSettings: () => void;
  manage: NonNullable<Parameters<typeof CategoryHome>[0]["manage"]>;
}) {
  return (
    <div className="space-y-3.5 pb-20">
      <TopNav
        list={{ onClick: () => window.scrollTo({ top: 0 }) }}
        add={{ onClick: onNewIdea }}
        settings={{ onClick: onSettings }}
      />
      <SpaceHeader
        name={space.name}
        memberNames={space.members.map((member) => member.name)}
      />

      <StatusTabs
        status={status}
        counts={countByStatus(space.items)}
        onStatusChange={onStatusChange}
      />

      <CategoryHome
        categories={categories}
        items={itemsWithRatings(space)}
        status={status}
        memberNames={memberNamesOf(space)}
        memberOrder={space.members.map((member) => member.id)}
        onOpen={onOpen}
        manage={manage}
      />

      <button type="button" className={FAB} onClick={onNewIdea}>
        <span aria-hidden="true">＋</span>
        Nova ideia
      </button>
    </div>
  );
}

// Dentro da categoria (52/53) e "Adicionados recentemente" (C8): a mesma
// ItemsScreen do app, com a ordem em estado (no app, ?ordem=nota).
function DemoItemsScreen({
  space,
  user,
  categories,
  status,
  categoryId,
  sort,
  view,
  onViewChange,
  onSortChange,
  onBack,
  onAdd,
  onOpen,
  options,
}: {
  space: DemoSpace;
  user: DemoUser;
  categories: Category[];
  status: ItemStatus;
  // null = recentes.
  categoryId: string | null;
  sort: ItemSort;
  view: ItemView;
  onViewChange: (view: ItemView) => void;
  onSortChange: (sort: ItemSort) => void;
  onBack: () => void;
  onAdd: (categoryId?: string) => void;
  onOpen: (itemId: string) => void;
  // "···" da categoria (menu 55).
  options: (category: Category, preview: { count: number; sample: string }) => React.ReactNode;
}) {
  const all = itemsWithRatings(space);
  const category = categoryId
    ? categories.find((candidate) => candidate.id === categoryId)
    : null;
  const withSort = category ? showsScoreSort(category, status) : false;
  const items = category
    ? categoryItems(all, category, status, sort)
    : recentItems(all, status);
  const partner = space.members.find((member) => member.id !== user.id);

  return (
    <div className="pb-20">
      <ItemsScreen
        backLabel={STATUS_LABELS[status]}
        back={{ onClick: onBack }}
        title={category ? categoryTitle(category) : LIST_COPY.recentScreenTitle}
        count={category ? items.length : undefined}
        initialView={view}
        onViewChange={onViewChange}
        partnerName={partner?.name ?? null}
        sort={
          withSort
            ? {
                value: sort,
                options: {
                  score: { onClick: () => onSortChange("score") },
                  recent: { onClick: () => onSortChange("recent") },
                },
              }
            : null
        }
        average={withSort ? categoryScoreAverage(items) : null}
        add={
          category
            ? {
                name: category.name,
                onClick: () => onAdd(category.id),
                tile: status === "want",
              }
            : null
        }
        options={
          category
            ? options(category, {
                count: items.length,
                sample: categorySampleText(
                  categoryItems(all, category, status)
                    .slice(0, 2)
                    .map((item) => item.title),
                  items.length,
                ),
              })
            : null
        }
        items={items}
        categoriesById={Object.fromEntries(
          categories.map((candidate) => [candidate.id, candidate]),
        )}
        memberNames={memberNamesOf(space)}
        memberOrder={space.members.map((member) => member.id)}
        imagesById={demoItemImages(items)}
        onOpen={onOpen}
      />
      <button type="button" className={FAB} onClick={() => onAdd(category?.id)}>
        <span aria-hidden="true">＋</span>
        Nova ideia
      </button>
    </div>
  );
}

function memberNamesOf(space: DemoSpace): Record<string, string> {
  return Object.fromEntries(
    space.members.map((member) => [member.id, member.name]),
  );
}

function Detail({
  space,
  itemId,
  categories,
  user,
  onBack,
  onMoveCategory,
  onRate,
}: {
  space: DemoSpace;
  itemId: string;
  categories: Category[];
  user: DemoUser;
  onBack: () => void;
  // "✎ Editar" → campo "Categoria": muda só category_id.
  onMoveCategory: (categoryId: string) => void;
  onRate: (payload: {
    food?: number | null;
    service?: number | null;
    ambiance?: number | null;
    score?: number | null;
  }) => void;
}) {
  const item = space.items.find((i) => i.id === itemId);
  const rating = space.ratings.find((r) => r.item_id === itemId);
  // Texto como digitado ("8,2"); notas antigas inteiras aparecem como "8,0".
  const [food, setFood] = useState(scoreInputValue(rating?.food));
  const [service, setService] = useState(scoreInputValue(rating?.service));
  const [ambiance, setAmbiance] = useState(scoreInputValue(rating?.ambiance));
  const [score, setScore] = useState(scoreInputValue(rating?.score));
  const [formOpen, setFormOpen] = useState(!rating);
  const [scoreError, setScoreError] = useState<string | null>(null);
  const [categoryId, setCategoryId] = useState<string | null>(
    space.items.find((i) => i.id === itemId)?.category_id ?? null,
  );

  function rate(read: () => Parameters<typeof onRate>[0]) {
    try {
      const payload = read();
      setScoreError(null);
      onRate(payload);
    } catch (error) {
      setScoreError(
        error instanceof Error ? error.message : "Informe uma nota de 1 a 10.",
      );
    }
  }

  if (!item) {
    return (
      <div className="text-cream">
        <p>Item não encontrado.</p>
        <button type="button" className="mt-4 underline" onClick={onBack}>
          Voltar
        </button>
      </div>
    );
  }

  const category = categories.find((candidate) => candidate.id === item.category_id);
  const raterName = rating ? memberName(space, rating.rated_by) : null;
  const couple = coupleScore(rating ? [rating] : []);

  return (
    <div className="space-y-3.5">
      <button type="button" className={BACK_LINK} onClick={onBack}>
        ← {STATUS_LABELS[item.status]}
      </button>

      <ItemHero
        type={item.type}
        category={category}
        title={item.title}
        subtitle={heroSubtitle(
          heroCategoryLabel(item.type, category),
          addedByLabel(memberName(space, item.created_by), item.created_at),
        )}
        badge={heroBadge(item)}
      >
        {item.notes ? (
          <p className="mt-1 text-[13px] text-cream/55">{item.notes}</p>
        ) : null}
        {item.url ? (
          <a
            href={item.url}
            target="_blank"
            rel="noreferrer"
            className="mt-1 block break-all text-sm text-cream underline decoration-cream/40"
          >
            {item.url}
          </a>
        ) : null}
      </ItemHero>

      <ActivityNoAddressNote item={item} />

      <CoupleScoreCard
        couple={couple}
        caption={
          raterName ? `só ${raterName} deu nota até agora` : "média de vocês dois"
        }
        emptyText="Ainda sem nota. Salvem a primeira avaliação quando fizerem esta ideia."
        people={space.members.map((member, index) => {
          const mine = rating?.rated_by === member.id ? rating : null;
          return {
            id: member.id,
            name: member.name,
            tone: memberTone(index),
            average: mine ? personAverage(mine) : null,
            chips: mine ? ratingChips(mine) : [],
            comment: mine?.comment ?? null,
          };
        })}
      />

      {formOpen ? (
        <div className={`${CARD} space-y-4`}>
          <h2 className="text-2xl leading-tight">
            {rating ? "Editar nota" : "Marcar como feito e dar nota"}
          </h2>
          {item.type === "restaurant" ? (
            <div className="space-y-4">
              <div className="grid grid-cols-3 gap-2.5">
                <ScoreInput label="Comida" value={food} onChange={(e) => setFood(e.target.value)} />
                <ScoreInput label="Atendimento" value={service} onChange={(e) => setService(e.target.value)} />
                <ScoreInput label="Ambiente" value={ambiance} onChange={(e) => setAmbiance(e.target.value)} />
              </div>
              {scoreError ? <ScoreError text={scoreError} /> : null}
              <button
                type="button"
                className={BTN_PRIMARY}
                onClick={() =>
                  rate(() => ({
                    food: parseScore(food),
                    service: parseScore(service),
                    ambiance: parseScore(ambiance),
                    score: null,
                  }))
                }
              >
                Salvar nota
              </button>
            </div>
          ) : (
            <div className="space-y-4">
              <ScoreInput label="Nota" value={score} onChange={(e) => setScore(e.target.value)} />
              {scoreError ? <ScoreError text={scoreError} /> : null}
              <button
                type="button"
                className={BTN_PRIMARY}
                onClick={() =>
                  rate(() => ({
                    score: parseScore(score),
                    food: null,
                    service: null,
                    ambiance: null,
                  }))
                }
              >
                Salvar nota
              </button>
            </div>
          )}
          <p className="text-xs text-ink/60">Logado como {user.name}</p>
        </div>
      ) : null}

      {rating ? (
        <button
          type="button"
          className={formOpen ? BTN_OUTLINE : BTN_SOFT}
          aria-expanded={formOpen}
          onClick={() => setFormOpen((open) => !open)}
        >
          {formOpen ? "Depois" : "✎ Editar minha nota"}
        </button>
      ) : null}

      {/* Como o ✎ Editar do app: aqui, só o campo "Categoria" (C16). */}
      <EditDisclosure>
        <form
          className={`${CARD} space-y-4`}
          onSubmit={(event) => {
            event.preventDefault();
            if (categoryId && categoryId !== item.category_id) onMoveCategory(categoryId);
          }}
        >
          <CategoryField
            name="demo_category_id"
            categories={categories}
            value={categoryId}
            onChange={setCategoryId}
            legendClassName="mb-1.5 text-sm font-semibold text-ink"
          />
          <button
            type="submit"
            disabled={!categoryId || categoryId === item.category_id}
            className={BTN_PRIMARY}
          >
            Salvar alterações
          </button>
        </form>
      </EditDisclosure>
    </div>
  );
}

function ScoreError({ text }: { text: string }) {
  return (
    <p className="rounded-xl bg-red-50 px-4 py-3 text-sm font-medium text-danger">
      {text}
    </p>
  );
}

function Settings({
  space,
  user,
  onBack,
  onReset,
}: {
  space: DemoSpace;
  user: DemoUser;
  onBack: () => void;
  onReset: () => void;
}) {
  return (
    <div className="space-y-4">
      <button type="button" className="text-sm text-cream/70" onClick={onBack}>
        ← Voltar
      </button>
      <h1 className="font-serif text-2xl text-cream">Ajustes</h1>
      <div className="rounded-2xl bg-surface p-4 text-sm">
        <p>
          <span className="text-accent-strong/65">Espaço:</span> {space.name}
        </p>
        <p className="mt-2">
          <span className="text-accent-strong/65">Você:</span> {user.name}
        </p>
        <p className="mt-2">
          <span className="text-accent-strong/65">Membros:</span>{" "}
          {space.members.map((m) => m.name).join(", ")}
        </p>
        <p className="mt-2">
          <span className="text-accent-strong/65">Ideias:</span> {space.items.length}
        </p>
        <p className="mt-2">
          <span className="text-accent-strong/65">Viagens:</span> {space.trips.length}
        </p>
      </div>
      <p className="text-xs leading-5 text-cream/65">
        Isto é a vitrine: os dados ficam só neste aparelho e não vão para a
        conta de vocês. Limpar volta para os dados de exemplo.
      </p>
      <button
        type="button"
        className="h-12 w-full rounded-xl border border-danger/30 bg-red-50 font-medium text-danger"
        onClick={onReset}
      >
        Limpar dados deste aparelho
      </button>
    </div>
  );
}
