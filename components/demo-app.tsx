"use client";

import { useEffect, useMemo, useRef, useState } from "react";

import { TYPE_LABELS, STATUS_LABELS } from "@/lib/labels";
import { assertScore } from "@/lib/ratings";
import {
  filterItems,
  ratingSavedMessage,
  statusFilterAfterRating,
  typeFilterAfterRating,
} from "@/lib/demo/after-rating";
import type { Item, ItemStatus, ItemType } from "@/lib/types";
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
import { DemoHub } from "@/components/demo-hub";
import { DemoShowcaseBanner } from "@/components/demo-showcase-banner";
import { IdeaWizard } from "@/components/demo-idea-wizard";
import { TripWizard } from "@/components/demo-trip-wizard";
import { TripDetail, TripsHome } from "@/components/demo-trips";

const ITEM_TYPES = Object.keys(TYPE_LABELS) as ItemType[];

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

function formatScore(value: number | null) {
  if (value == null) return null;
  return value.toLocaleString("pt-BR", {
    minimumFractionDigits: Number.isInteger(value) ? 0 : 1,
    maximumFractionDigits: 1,
  });
}

export function DemoApp() {
  const [state, setState] = useState<DemoState | null>(null);
  const [screen, setScreen] = useState<Screen>({ name: "hub" });
  const [message, setMessage] = useState<string | null>(null);
  const [messageAction, setMessageAction] = useState<MessageAction | null>(null);
  const [typeFilter, setTypeFilter] = useState<ItemType | "all">("all");
  const [statusFilter, setStatusFilter] = useState<ItemStatus | "all">("want");
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
        <div className="mx-4 mt-4 rounded-xl bg-accent-soft px-3 py-2 text-sm text-accent-strong">
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
                  setStatusFilter(statusFilterAfterRating(statusFilter));
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
}: {
  space: DemoSpace;
  items: Item[];
  typeFilter: ItemType | "all";
  statusFilter: ItemStatus | "all";
  onTypeFilter: (v: ItemType | "all") => void;
  onStatusFilter: (v: ItemStatus | "all") => void;
  highlightItemId: string | null;
  onHighlightDone: () => void;
  onOpen: (id: string) => void;
  onBack: () => void;
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

  return (
    <div className="space-y-4">
      <button type="button" className="text-sm text-cream/70" onClick={onBack}>
        ← Voltar
      </button>
      <div className="grid grid-cols-2 gap-2">
        <select
          className="h-12 rounded-xl border border-border bg-surface px-3 text-sm"
          value={typeFilter}
          onChange={(e) => onTypeFilter(e.target.value as ItemType | "all")}
        >
          <option value="all">Todos os tipos</option>
          {ITEM_TYPES.map((type) => (
            <option key={type} value={type}>
              {TYPE_LABELS[type]}
            </option>
          ))}
        </select>
        <select
          className="h-12 rounded-xl border border-border bg-surface px-3 text-sm"
          value={statusFilter}
          onChange={(e) => onStatusFilter(e.target.value as ItemStatus | "all")}
        >
          {(["all", "want", "done"] as const).map((status) => (
            <option key={status} value={status}>
              {STATUS_LABELS[status]}
            </option>
          ))}
        </select>
      </div>

      {items.length === 0 ? (
        <p className="rounded-xl bg-surface-muted px-4 py-8 text-center text-sm text-accent-strong/70">
          Nenhuma ideia ainda
        </p>
      ) : (
        <ul ref={listRef} className="space-y-2">
          {items.map((item) => {
            const score = ratingForItem(space, item.id);
            return (
              <li key={item.id} data-item-id={item.id}>
                <button
                  type="button"
                  onClick={() => onOpen(item.id)}
                  className={`flex w-full items-start justify-between gap-3 rounded-2xl bg-surface px-4 py-3 text-left shadow-sm shadow-accent-strong/5 transition-shadow duration-300 ${item.id === highlightItemId ? "ring-2 ring-accent" : ""}`}
                >
                  <div>
                    <p className="font-medium text-accent-strong">{item.title}</p>
                    <p className="mt-1 text-xs text-accent-strong/65">
                      {TYPE_LABELS[item.type]} · {STATUS_LABELS[item.status]}
                    </p>
                  </div>
                  {score != null ? (
                    <span className="rounded-lg bg-accent-soft px-2 py-1 text-sm font-semibold text-accent-strong">
                      {formatScore(score)}
                    </span>
                  ) : null}
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
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
  const [food, setFood] = useState(rating?.food ?? 7);
  const [service, setService] = useState(rating?.service ?? 7);
  const [ambiance, setAmbiance] = useState(rating?.ambiance ?? 7);
  const [score, setScore] = useState(rating?.score ?? 7);

  if (!item) {
    return (
      <div>
        <p>Item não encontrado.</p>
        <button type="button" className="mt-4 underline" onClick={onBack}>
          Voltar
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <button type="button" className="text-sm text-cream/70" onClick={onBack}>
        ← Voltar
      </button>
      <h1 className="font-serif text-3xl text-cream">{item.title}</h1>
      <p className="text-sm text-cream/70">
        {TYPE_LABELS[item.type]} · {STATUS_LABELS[item.status]}
      </p>
      <p className="text-sm text-cream/70">
        Criado por {memberName(space, item.created_by)}
        {rating ? ` · Nota por ${memberName(space, rating.rated_by)}` : ""}
      </p>
      {item.url ? (
        <a
          href={item.url}
          target="_blank"
          rel="noreferrer"
          className="block break-all text-sm text-cream underline decoration-cream/40"
        >
          {item.url}
        </a>
      ) : null}
      {item.notes ? <p className="text-sm text-cream/80">{item.notes}</p> : null}

      <div className="rounded-2xl bg-surface p-4">
        <h2 className="font-medium">
          {rating ? "Editar nota" : "Marcar como feito e dar nota"}
        </h2>
        {item.type === "restaurant" ? (
          <div className="mt-3 space-y-3">
            <ScoreSelect label="Comida" value={food} onChange={setFood} />
            <ScoreSelect label="Atendimento" value={service} onChange={setService} />
            <ScoreSelect label="Ambiente" value={ambiance} onChange={setAmbiance} />
            <button
              type="button"
              className="mt-2 h-12 w-full rounded-xl bg-accent font-medium text-accent-contrast"
              onClick={() =>
                onRate({ food, service, ambiance, score: null })
              }
            >
              Salvar nota
            </button>
          </div>
        ) : (
          <div className="mt-3 space-y-3">
            <ScoreSelect label="Nota" value={score} onChange={setScore} />
            <button
              type="button"
              className="mt-2 h-12 w-full rounded-xl bg-accent font-medium text-accent-contrast"
              onClick={() =>
                onRate({ score, food: null, service: null, ambiance: null })
              }
            >
              Salvar nota
            </button>
          </div>
        )}
        <p className="mt-3 text-xs text-accent-strong/60">Logado como {user.name}</p>
      </div>
    </div>
  );
}

function ScoreSelect({
  label,
  value,
  onChange,
}: {
  label: string;
  value: number;
  onChange: (n: number) => void;
}) {
  return (
    <label className="block text-sm">
      {label}
      <select
        className="mt-1 h-12 w-full rounded-xl border border-border bg-surface px-3"
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
      >
        {Array.from({ length: 10 }, (_, i) => i + 1).map((n) => (
          <option key={n} value={n}>
            {n}
          </option>
        ))}
      </select>
    </label>
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
