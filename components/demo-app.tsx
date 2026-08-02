"use client";

import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";

import { TYPE_LABELS, STATUS_LABELS } from "@/lib/labels";
import { assertScore } from "@/lib/ratings";
import type { Item, ItemStatus, ItemType } from "@/lib/types";
import {
  addItem,
  createSpace,
  createTrip,
  createUser,
  decodeSpace,
  encodeSpace,
  loadState,
  memberName,
  mergeSpaces,
  ratingForItem,
  saveState,
  upsertRating,
  type DemoSpace,
  type DemoState,
  type DemoUser,
} from "@/lib/demo/store";
import { DemoHub } from "@/components/demo-hub";
import { IdeaWizard } from "@/components/demo-idea-wizard";
import { TripWizard } from "@/components/demo-trip-wizard";
import { TripDetail, TripsHome } from "@/components/demo-trips";

const ITEM_TYPES = Object.keys(TYPE_LABELS) as ItemType[];

type Screen =
  | { name: "welcome" }
  | { name: "hub" }
  | { name: "ideas" }
  | { name: "idea-wizard" }
  | { name: "detail"; itemId: string }
  | { name: "trips" }
  | { name: "trip-new" }
  | { name: "trip-detail"; tripId: string }
  | { name: "sync" }
  | { name: "settings" };

function formatScore(value: number | null) {
  if (value == null) return null;
  return value.toLocaleString("pt-BR", {
    minimumFractionDigits: Number.isInteger(value) ? 0 : 1,
    maximumFractionDigits: 1,
  });
}

export function DemoApp() {
  const searchParams = useSearchParams();
  const initialSync = searchParams.get("sync") ?? undefined;
  const [ready, setReady] = useState(false);
  const [state, setState] = useState<DemoState>({ user: null, space: null });
  const [screen, setScreen] = useState<Screen>({ name: "welcome" });
  const [name, setName] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [typeFilter, setTypeFilter] = useState<ItemType | "all">("all");
  const [statusFilter, setStatusFilter] = useState<ItemStatus | "all">("want");

  useEffect(() => {
    const loaded = loadState();
    let next = loaded;

    if (initialSync) {
      const incoming = decodeSpace(initialSync);
      if (incoming) {
        if (loaded.space) {
          next = {
            ...loaded,
            space: mergeSpaces(loaded.space, incoming),
          };
          setMessage("Lista sincronizada com o link recebido.");
        } else if (loaded.user) {
          const alreadyMember = incoming.members.some((m) => m.id === loaded.user!.id);
          const members = alreadyMember
            ? incoming.members
            : [...incoming.members, loaded.user].slice(0, 2);
          next = {
            user: loaded.user,
            space: { ...incoming, members },
          };
          setMessage("Você entrou no espaço pelo link.");
        } else {
          next = { user: null, space: incoming };
          setMessage("Link de sync recebido. Entre com seu nome para continuar.");
        }
        saveState(next);
      }
    }

    setState(next);
    setScreen(next.user && next.space ? { name: "hub" } : { name: "welcome" });
    setReady(true);
  }, [initialSync]);

  function persist(next: DemoState) {
    setState(next);
    saveState(next);
  }

  const filteredItems = useMemo(() => {
    if (!state.space) return [];
    return state.space.items.filter((item) => {
      const typeOk = typeFilter === "all" || item.type === typeFilter;
      const statusOk = statusFilter === "all" || item.status === statusFilter;
      return typeOk && statusOk;
    });
  }, [state.space, typeFilter, statusFilter]);

  if (!ready) {
    return (
      <main className="mx-auto flex min-h-dvh w-full max-w-lg items-center justify-center px-4">
        <p className="text-sm text-accent-strong/70">Carregando Juntos…</p>
      </main>
    );
  }

  if (screen.name === "welcome" || !state.user) {
    return (
      <Welcome
        name={name}
        setName={setName}
        message={message}
        pendingSpace={state.space}
        onContinue={(userName) => {
          const user = createUser(userName);
          if (state.space) {
            const already = state.space.members.some((m) => m.name === user.name);
            const members = already
              ? state.space.members
              : [...state.space.members, user].slice(0, 2);
            const space = { ...state.space, members };
            persist({ user, space });
          } else {
            persist({ user, space: null });
          }
          setScreen({ name: "hub" });
          setMessage(null);
        }}
        onCreate={(userName) => {
          const user = createUser(userName);
          const space = createSpace(user);
          persist({ user, space });
          setScreen({ name: "hub" });
          setMessage("Espaço criado. Depois use Sincronizar para mandar o link.");
        }}
      />
    );
  }

  if (!state.space) {
    return (
      <NoSpace
        user={state.user}
        onCreate={() => {
          const space = createSpace(state.user!);
          persist({ ...state, space });
          setScreen({ name: "hub" });
        }}
        onPasteSync={(payload) => {
          const incoming = decodeSpace(payload.trim());
          if (!incoming) {
            setMessage("Código inválido.");
            return;
          }
          const members = incoming.members.some((m) => m.id === state.user!.id)
            ? incoming.members
            : [...incoming.members, state.user!].slice(0, 2);
          persist({ user: state.user, space: { ...incoming, members } });
          setScreen({ name: "hub" });
          setMessage("Espaço importado.");
        }}
        message={message}
      />
    );
  }

  const space = state.space;
  const user = state.user;

  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-lg flex-col">
      <header className="sticky top-0 z-20 border-b border-border/70 bg-surface/90 px-4 py-3 backdrop-blur">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="font-serif text-xl text-accent-strong">Juntos</p>
            <p className="text-xs text-accent-strong/70">
              Modo demo · {user.name}
            </p>
          </div>
          <div className="flex gap-2">
            <button
              type="button"
              className="inline-flex h-11 min-w-11 items-center justify-center rounded-xl bg-accent-soft px-3 text-sm font-medium text-accent-strong"
              onClick={() => setScreen({ name: "sync" })}
            >
              Sync
            </button>
            <button
              type="button"
              className="inline-flex h-11 min-w-11 items-center justify-center rounded-xl bg-accent text-lg font-semibold text-accent-contrast"
              onClick={() =>
                setScreen(
                  screen.name === "trips" ||
                    screen.name === "trip-detail" ||
                    screen.name === "trip-new"
                    ? { name: "trip-new" }
                    : { name: "idea-wizard" },
                )
              }
              aria-label="Adicionar"
            >
              +
            </button>
          </div>
        </div>
      </header>

      {message ? (
        <div className="mx-4 mt-3 rounded-xl bg-accent-soft px-3 py-2 text-sm text-accent-strong">
          {message}
        </div>
      ) : null}

      <main className="flex-1 px-4 pb-28 pt-4">
        {screen.name === "hub" ? (
          <DemoHub
            onIdea={() => setScreen({ name: "idea-wizard" })}
            onTrip={() => setScreen({ name: "trip-new" })}
            onSeeIdeas={() => setScreen({ name: "ideas" })}
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
            onOpen={(itemId) => setScreen({ name: "detail", itemId })}
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
              setMessage("Ideia salva neste aparelho. Use Sync para enviar.");
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
                const nextSpace = upsertRating(space, {
                  itemId: screen.itemId,
                  ratedBy: user.id,
                  ...payload,
                });
                persist({ user, space: nextSpace });
                setMessage("Nota salva.");
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
          />
        ) : null}

        {screen.name === "trip-new" ? (
          <TripWizard
            onCancel={() => setScreen({ name: "trips" })}
            onSave={(input) => {
              const nextSpace = createTrip(space, input);
              persist({ user, space: nextSpace });
              const tripId = nextSpace.trips[0]?.id;
              setMessage("Viagem criada. Use Sync para enviar à parceira.");
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
                  <p className="text-sm">Viagem não encontrada.</p>
                  <button
                    type="button"
                    className="text-sm underline"
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
                onBack={() => setScreen({ name: "trips" })}
                onChange={(updater) => {
                  persist({ user, space: updater(space) });
                }}
              />
            );
          })()
        ) : null}

        {screen.name === "sync" ? (
          <SyncPanel
            space={space}
            onBack={() => setScreen({ name: "hub" })}
            onImport={(payload) => {
              const incoming = decodeSpace(payload.trim());
              if (!incoming) {
                setMessage("Código inválido.");
                return;
              }
              const merged = mergeSpaces(space, incoming);
              persist({ user, space: merged });
              setScreen({ name: "hub" });
              setMessage("Listas e viagens mescladas.");
            }}
          />
        ) : null}

        {screen.name === "settings" ? (
          <Settings
            space={space}
            user={user}
            onBack={() => setScreen({ name: "hub" })}
            onReset={() => {
              persist({ user: null, space: null });
              setScreen({ name: "welcome" });
            }}
          />
        ) : null}
      </main>

      <nav className="fixed inset-x-0 bottom-0 z-20 border-t border-border/70 bg-surface/95 px-4 py-3 backdrop-blur">
        <div className="mx-auto flex max-w-lg gap-1.5">
          <NavButton
            active={screen.name === "hub" || screen.name === "idea-wizard"}
            onClick={() => setScreen({ name: "hub" })}
          >
            Início
          </NavButton>
          <NavButton
            active={
              screen.name === "trips" ||
              screen.name === "trip-new" ||
              screen.name === "trip-detail"
            }
            onClick={() => setScreen({ name: "trips" })}
          >
            Viagens
          </NavButton>
          <NavButton active={screen.name === "sync"} onClick={() => setScreen({ name: "sync" })}>
            Sync
          </NavButton>
          <NavButton
            active={screen.name === "settings"}
            onClick={() => setScreen({ name: "settings" })}
          >
            Ajustes
          </NavButton>
        </div>
      </nav>
    </div>
  );
}

function NavButton({
  children,
  active,
  onClick,
}: {
  children: React.ReactNode;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`h-12 flex-1 rounded-xl text-sm font-medium ${
        active
          ? "bg-accent text-accent-contrast"
          : "bg-surface-muted text-accent-strong"
      }`}
    >
      {children}
    </button>
  );
}

function Welcome({
  name,
  setName,
  onContinue,
  onCreate,
  pendingSpace,
  message,
}: {
  name: string;
  setName: (v: string) => void;
  onContinue: (name: string) => void;
  onCreate: (name: string) => void;
  pendingSpace: DemoSpace | null;
  message: string | null;
}) {
  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-lg flex-col justify-center px-4 py-8">
      <p className="font-serif text-4xl text-accent-strong">Juntos</p>
      <p className="mt-2 text-base text-accent-strong/80">
        Modo demo no celular: salve ideias, dê nota e sincronize com um link.
      </p>
      {message ? (
        <p className="mt-4 rounded-xl bg-accent-soft px-3 py-2 text-sm text-accent-strong">
          {message}
        </p>
      ) : null}
      <label className="mt-8 block text-sm font-medium text-accent-strong">
        Seu nome
        <input
          className="mt-2 h-12 w-full rounded-xl border border-border bg-surface px-3"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Ex.: Mauricio"
          autoComplete="name"
        />
      </label>
      <div className="mt-6 flex flex-col gap-3">
        {pendingSpace ? (
          <button
            type="button"
            className="h-12 rounded-xl bg-accent font-medium text-accent-contrast"
            onClick={() => onContinue(name)}
            disabled={!name.trim()}
          >
            Entrar no espaço recebido
          </button>
        ) : (
          <button
            type="button"
            className="h-12 rounded-xl bg-accent font-medium text-accent-contrast disabled:opacity-50"
            onClick={() => onCreate(name)}
            disabled={!name.trim()}
          >
            Criar nosso espaço
          </button>
        )}
      </div>
      <p className="mt-6 text-xs leading-5 text-accent-strong/65">
        Os dados ficam neste aparelho. Para a outra pessoa ver a mesma lista, use a
        aba Sync e envie o link (WhatsApp/iMessage).
      </p>
    </main>
  );
}

function NoSpace({
  user,
  onCreate,
  onPasteSync,
  message,
}: {
  user: DemoUser;
  onCreate: () => void;
  onPasteSync: (payload: string) => void;
  message: string | null;
}) {
  const [paste, setPaste] = useState("");
  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-lg flex-col px-4 py-8">
      <p className="font-serif text-3xl text-accent-strong">Olá, {user.name}</p>
      {message ? (
        <p className="mt-3 rounded-xl bg-accent-soft px-3 py-2 text-sm">{message}</p>
      ) : null}
      <button
        type="button"
        className="mt-8 h-12 rounded-xl bg-accent font-medium text-accent-contrast"
        onClick={onCreate}
      >
        Criar nosso espaço
      </button>
      <label className="mt-8 block text-sm font-medium">
        Ou cole um código Sync
        <textarea
          className="mt-2 min-h-28 w-full rounded-xl border border-border bg-surface p-3 text-sm"
          value={paste}
          onChange={(e) => setPaste(e.target.value)}
          placeholder="Cole o código ou o trecho sync=..."
        />
      </label>
      <button
        type="button"
        className="mt-3 h-12 rounded-xl bg-accent-soft font-medium text-accent-strong"
        onClick={() => {
          const raw = paste.includes("sync=")
            ? (new URL(paste, "https://example.com").searchParams.get("sync") ?? paste)
            : paste;
          onPasteSync(raw);
        }}
      >
        Importar
      </button>
    </main>
  );
}

function Home({
  space,
  items,
  typeFilter,
  statusFilter,
  onTypeFilter,
  onStatusFilter,
  onOpen,
}: {
  space: DemoSpace;
  items: Item[];
  typeFilter: ItemType | "all";
  statusFilter: ItemStatus | "all";
  onTypeFilter: (v: ItemType | "all") => void;
  onStatusFilter: (v: ItemStatus | "all") => void;
  onOpen: (id: string) => void;
}) {
  return (
    <div className="space-y-4">
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
        <ul className="space-y-2">
          {items.map((item) => {
            const score = ratingForItem(space, item.id);
            return (
              <li key={item.id}>
                <button
                  type="button"
                  onClick={() => onOpen(item.id)}
                  className="flex w-full items-start justify-between gap-3 rounded-2xl bg-surface px-4 py-3 text-left shadow-sm shadow-accent-strong/5"
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
      <button type="button" className="text-sm text-accent-strong/70" onClick={onBack}>
        ← Voltar
      </button>
      <h1 className="font-serif text-3xl text-accent-strong">{item.title}</h1>
      <p className="text-sm text-accent-strong/70">
        {TYPE_LABELS[item.type]} · {STATUS_LABELS[item.status]}
      </p>
      <p className="text-sm text-accent-strong/70">
        Criado por {memberName(space, item.created_by)}
        {rating ? ` · Nota por ${memberName(space, rating.rated_by)}` : ""}
      </p>
      {item.url ? (
        <a
          href={item.url}
          target="_blank"
          rel="noreferrer"
          className="block break-all text-sm text-accent underline"
        >
          {item.url}
        </a>
      ) : null}
      {item.notes ? <p className="text-sm">{item.notes}</p> : null}

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

function SyncPanel({
  space,
  onBack,
  onImport,
}: {
  space: DemoSpace;
  onBack: () => void;
  onImport: (payload: string) => void;
}) {
  const payload = encodeSpace(space);
  const [link, setLink] = useState("");
  const [paste, setPaste] = useState("");
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    const base = process.env.NEXT_PUBLIC_BASE_PATH || "";
    setLink(`${window.location.origin}${base}/?sync=${payload}`);
  }, [payload]);

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(link);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  }

  async function share() {
    if (navigator.share) {
      await navigator.share({
        title: "Juntos — nossa lista",
        text: "Abre no celular para sincronizar nossa lista do Juntos",
        url: link,
      });
      return;
    }
    await copyLink();
  }

  return (
    <div className="space-y-4">
      <button type="button" className="text-sm text-accent-strong/70" onClick={onBack}>
        ← Voltar
      </button>
      <h1 className="font-serif text-2xl text-accent-strong">Sincronizar</h1>
      <p className="text-sm leading-6 text-accent-strong/75">
        Sem backend ainda: mande este link no WhatsApp. A outra pessoa abre, entra com o
        nome dela e vê a lista e as viagens. Quando ela adicionar algo, ela manda o Sync
        de volta para mesclar.
      </p>
      <textarea
        readOnly
        className="min-h-28 w-full rounded-xl border border-border bg-surface p-3 text-xs"
        value={link}
      />
      <div className="flex gap-2">
        <button
          type="button"
          className="h-12 flex-1 rounded-xl bg-accent font-medium text-accent-contrast"
          onClick={() => void share()}
        >
          Compartilhar
        </button>
        <button
          type="button"
          className="h-12 flex-1 rounded-xl bg-accent-soft font-medium text-accent-strong"
          onClick={() => void copyLink()}
        >
          {copied ? "Copiado" : "Copiar link"}
        </button>
      </div>
      <label className="block text-sm font-medium">
        Colar Sync recebido
        <textarea
          className="mt-2 min-h-24 w-full rounded-xl border border-border bg-surface p-3 text-sm"
          value={paste}
          onChange={(e) => setPaste(e.target.value)}
          placeholder="Cole o link ou o código sync"
        />
      </label>
      <button
        type="button"
        className="h-12 w-full rounded-xl bg-surface-strong font-medium text-accent-strong"
        onClick={() => {
          try {
            if (paste.includes("sync=")) {
              const url = new URL(paste, window.location.origin);
              onImport(url.searchParams.get("sync") || paste);
            } else {
              onImport(paste);
            }
          } catch {
            onImport(paste);
          }
        }}
      >
        Mesclar lista recebida
      </button>
    </div>
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
      <button type="button" className="text-sm text-accent-strong/70" onClick={onBack}>
        ← Voltar
      </button>
      <h1 className="font-serif text-2xl text-accent-strong">Ajustes</h1>
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
      <p className="text-xs leading-5 text-accent-strong/65">
        Modo demo local. Quando tivermos projeto Supabase, migraremos para conta real com
        sync automático.
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
