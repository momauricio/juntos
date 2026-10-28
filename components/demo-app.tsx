"use client";

import { useEffect, useMemo, useRef, useState } from "react";

import { STATUS_LABELS } from "@/lib/labels";
import {
  assertScore,
  coupleScore,
  parseScore,
  personAverage,
  scoreInputValue,
} from "@/lib/ratings";
import { addedByLabel } from "@/lib/relative-time";
import {
  filterItems,
  ratingSavedMessage,
  typeFilterAfterRating,
  type TypeFilter,
} from "@/lib/demo/after-rating";
import { countByStatus, typeFilterSummary } from "@/lib/item-categories";
import type { Item, ItemStatus } from "@/lib/types";
import {
  addItem,
  createTrip,
  loadState,
  memberName,
  ratingForItem,
  sampleState,
  saveState,
  upsertRating,
  type DemoSpace,
  type DemoState,
  type DemoUser,
} from "@/lib/demo/store";
import { Avatar, initial, memberTone } from "@/components/avatar";
import { DemoHub } from "@/components/demo-hub";
import { ItemFilters, TypeFilterFooter } from "@/components/item-filters";
import {
  ActivityNoAddressNote,
  heroBadge,
  heroSubtitle,
  ITEM_CARD_CLASS,
  ItemCardContent,
  ItemHero,
  itemSubtitle,
  CoupleScoreCard,
  ratingChips,
} from "@/components/item-visuals";
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
  | { name: "ideas" }
  | { name: "idea-wizard" }
  | { name: "detail"; itemId: string }
  | { name: "trips" }
  | { name: "trip-new" }
  | { name: "trip-detail"; tripId: string }
  | { name: "settings" };

type MessageAction = { forMessage: string; label: string; onClick: () => void };

const HIGHLIGHT_MS = 2000;

export function DemoApp() {
  const [state, setState] = useState<DemoState | null>(null);
  const [screen, setScreen] = useState<Screen>({ name: "hub" });
  const [message, setMessage] = useState<string | null>(null);
  const [messageAction, setMessageAction] = useState<MessageAction | null>(null);
  const [typeFilter, setTypeFilter] = useState<TypeFilter>("all");
  const [statusFilter, setStatusFilter] = useState<ItemStatus>("want");
  const [highlightItemId, setHighlightItemId] = useState<string | null>(null);

  useEffect(() => {
    // localStorage só existe no cliente; o primeiro render é o do servidor.
    setState(loadState());
  }, []);

  function persist(next: DemoState) {
    setState(next);
    saveState(next);
  }

  const filteredItems = useMemo(() => {
    if (!state) return [];
    return filterItems(state.space.items, typeFilter, statusFilter);
  }, [state, typeFilter, statusFilter]);

  if (!state) {
    return (
      <div className="mx-auto flex min-h-dvh w-full max-w-lg flex-col">
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
    <div className="mx-auto flex min-h-dvh w-full max-w-lg flex-col">
      <DemoShowcaseBanner />
      {message ? (
        <div role="status" className="mx-4 mt-4 rounded-[18px] bg-cream px-3.5 py-3 text-[15px] font-semibold text-ink shadow-[0_14px_30px_rgba(0,0,0,0.35)]">
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

      <main className="flex-1 px-4 pb-10 pt-4">
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
            space={space}
            items={filteredItems}
            typeFilter={typeFilter}
            statusFilter={statusFilter}
            onTypeFilter={setTypeFilter}
            onStatusFilter={setStatusFilter}
            highlightItemId={highlightItemId}
            onHighlightDone={() => setHighlightItemId(null)}
            onOpen={(itemId) => setScreen({ name: "detail", itemId })}
            onBack={() => setScreen({ name: "hub" })}
            onNewIdea={() => setScreen({ name: "idea-wizard" })}
          />
        ) : null}

        {screen.name === "idea-wizard" ? (
          <IdeaWizard
            onCancel={() => setScreen({ name: "hub" })}
            onSave={(input) => {
              const nextSpace = addItem(space, {
                ...input,
                createdBy: user.id,
              });
              persist({ user, space: nextSpace });
              setScreen({ name: "hub" });
              setMessage("Ideia salva neste aparelho.");
            }}
          />
        ) : null}

        {screen.name === "detail" ? (
          <Detail
            space={space}
            itemId={screen.itemId}
            user={user}
            onBack={() => setScreen({ name: "ideas" })}
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
                  setTypeFilter(typeFilterAfterRating(typeFilter, item.type));
                  setHighlightItemId(item.id);
                }
                const text = ratingSavedMessage(item?.title ?? "", wasWant);
                setMessage(text);
                setMessageAction(wasWant ? { forMessage: text, label: "Ver Queremos", onClick: () => setStatusFilter("want") } : null);
                setScreen({ name: "ideas" });
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
              persist(sampleState());
              setScreen({ name: "hub" });
              setMessage("Dados de exemplo restaurados.");
            }}
          />
        ) : null}
      </main>
    </div>
  );
}

function Home({
  space,
  items,
  typeFilter,
  statusFilter,
  onTypeFilter,
  onStatusFilter,
  highlightItemId,
  onHighlightDone,
  onOpen,
  onBack,
  onNewIdea,
}: {
  space: DemoSpace;
  items: Item[];
  typeFilter: TypeFilter;
  statusFilter: ItemStatus;
  onTypeFilter: (v: TypeFilter) => void;
  onStatusFilter: (v: ItemStatus) => void;
  highlightItemId: string | null;
  onHighlightDone: () => void;
  onOpen: (id: string) => void;
  onBack: () => void;
  onNewIdea: () => void;
}) {
  const listRef = useRef<HTMLUListElement>(null);
  const onHighlightDoneRef = useRef(onHighlightDone);
  useEffect(() => {
    onHighlightDoneRef.current = onHighlightDone;
  });

  useEffect(() => {
    if (!highlightItemId) return;
    const el = listRef.current?.querySelector<HTMLElement>(`[data-item-id="${CSS.escape(highlightItemId)}"]`);
    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    el?.scrollIntoView({ behavior: reduceMotion ? "auto" : "smooth", block: "center" });
    const timeout = window.setTimeout(() => onHighlightDoneRef.current(), HIGHLIGHT_MS);
    return () => window.clearTimeout(timeout);
  }, [highlightItemId]);

  // Contagem das abas: respeita o tipo escolhido, ignora o status.
  const counts = countByStatus(filterItems(space.items, typeFilter, "all"));

  return (
    <div className="space-y-3.5 pb-20">
      <button type="button" className={BACK_LINK} onClick={onBack}>
        ← Voltar
      </button>
      <div className="flex items-center justify-between gap-4">
        <div className="min-w-0">
          <p className="text-xs font-semibold uppercase tracking-[0.24em] text-cream/60">
            Juntos
          </p>
          <h1 className="mt-1 text-[28px] font-medium leading-tight text-cream">
            {space.name}
          </h1>
        </div>
        <div aria-hidden="true" className="flex shrink-0 -space-x-2">
          {space.members.map((member, index) => (
            <Avatar
              key={member.id}
              label={initial(member.name)}
              size="md"
              tone={memberTone(index)}
            />
          ))}
        </div>
      </div>

      <ItemFilters
        typeChip={typeFilter}
        status={statusFilter}
        counts={counts}
        onTypeChange={onTypeFilter}
        onStatusChange={onStatusFilter}
      />

      {items.length === 0 ? (
        <p className={`${CARD} px-4 py-8 text-center text-sm text-ink/70`}>
          Nenhuma ideia ainda
        </p>
      ) : (
        <ul ref={listRef} className="flex flex-col gap-2.5">
          {items.map((item) => {
            const authorName = memberName(space, item.created_by);
            return (
              <li key={item.id} data-item-id={item.id}>
                <button
                  type="button"
                  onClick={() => onOpen(item.id)}
                  className={`${ITEM_CARD_CLASS} duration-300 ${item.id === highlightItemId ? "ring-2 ring-accent" : ""}`}
                >
                  <ItemCardContent
                    item={item}
                    subtitle={itemSubtitle(item.type, item.notes)}
                    author={{
                      name: authorName,
                      tone: memberTone(memberIndex(space, item.created_by)),
                    }}
                    addedLabel={addedByLabel(authorName, item.created_at)}
                    score={ratingForItem(space, item.id)}
                  />
                </button>
              </li>
            );
          })}
        </ul>
      )}

      {typeFilter !== "all" ? (
        <TypeFilterFooter
          summary={typeFilterSummary(typeFilter, counts[statusFilter], statusFilter)}
          onShowAll={() => onTypeFilter("all")}
        />
      ) : null}

      <button type="button" className={FAB} onClick={onNewIdea}>
        <span aria-hidden="true">＋</span>
        Nova ideia
      </button>
    </div>
  );
}

function memberIndex(space: DemoSpace, userId: string) {
  return space.members.findIndex((member) => member.id === userId);
}

function Detail({
  space,
  itemId,
  user,
  onBack,
  onRate,
}: {
  space: DemoSpace;
  itemId: string;
  user: DemoUser;
  onBack: () => void;
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

  const raterName = rating ? memberName(space, rating.rated_by) : null;
  const couple = coupleScore(rating ? [rating] : []);

  return (
    <div className="space-y-3.5">
      <button type="button" className={BACK_LINK} onClick={onBack}>
        ← {STATUS_LABELS[item.status]}
      </button>

      <ItemHero
        type={item.type}
        title={item.title}
        subtitle={heroSubtitle(
          item.type,
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
