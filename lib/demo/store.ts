import { displayRating } from "@/lib/ratings";
import type { Item, ItemStatus, ItemType, Rating } from "@/lib/types";

export type DemoUser = {
  id: string;
  name: string;
};

export type DocCategory =
  | "flight"
  | "reservation"
  | "ticket"
  | "insurance"
  | "other";

export type PackItem = {
  id: string;
  tripId: string;
  title: string;
  done: boolean;
  /** Member id, or "shared" for both */
  assigneeId: string;
  createdAt: string;
  updatedAt: string;
};

export type Stop = {
  id: string;
  tripId: string;
  day: number;
  title: string;
  notes: string | null;
  url: string | null;
  createdAt: string;
  updatedAt: string;
};

export type DocLink = {
  id: string;
  tripId: string;
  title: string;
  category: DocCategory;
  url: string;
  notes: string | null;
  /** Member id, or "shared" for both */
  assigneeId: string;
  createdAt: string;
  updatedAt: string;
};

export const SHARED_ASSIGNEE = "shared";

export function assigneeLabel(
  assigneeId: string,
  members: DemoUser[],
): string {
  if (assigneeId === SHARED_ASSIGNEE) return "Nós dois";
  return members.find((member) => member.id === assigneeId)?.name ?? "Alguém";
}

export type TripDestination = {
  id: string;
  name: string;
  startDate: string | null;
  endDate: string | null;
};

export type Trip = {
  id: string;
  title: string;
  destinations: TripDestination[];
  /** @deprecated legacy single field; normalized into destinations */
  destination: string | null;
  startDate: string | null; // derived cache: tripDateRange().start
  endDate: string | null;   // derived cache: tripDateRange().end
  notes: string | null;
  packItems: PackItem[];
  stops: Stop[];
  docs: DocLink[];
  createdAt: string;
  updatedAt: string;
};

export type DemoSpace = {
  id: string;
  name: string;
  members: DemoUser[];
  items: Item[];
  ratings: Rating[];
  trips: Trip[];
  updatedAt: string;
};

export type DemoState = {
  user: DemoUser;
  space: DemoSpace;
};

export const DOC_CATEGORY_LABELS: Record<DocCategory, string> = {
  flight: "Passagem",
  reservation: "Reserva",
  ticket: "Entrada",
  insurance: "Seguro",
  other: "Outro",
};

export const DOC_CATEGORIES = Object.keys(DOC_CATEGORY_LABELS) as DocCategory[];

const STORAGE_KEY = "juntos-demo-v1";

function nowIso() {
  return new Date().toISOString();
}

// A demo ainda não tem categorias de verdade: cada item aponta para a categoria
// padrão do seu tipo, com id fixo (sem mudar nada na tela).
export function demoCategoryId(type: ItemType): string {
  return `demo-category-${type}`;
}

function uid(prefix: string) {
  return `${prefix}_${Math.random().toString(36).slice(2, 10)}${Date.now().toString(36)}`;
}

export function tripDateRange(destinations: TripDestination[]): {
  start: string | null;
  end: string | null;
} {
  const starts = destinations.map((d) => d.startDate).filter(Boolean) as string[];
  const ends = destinations.map((d) => d.endDate).filter(Boolean) as string[];
  const start = starts.length ? starts.reduce((a, b) => (a < b ? a : b)) : null;
  const end = ends.length ? ends.reduce((a, b) => (a > b ? a : b)) : null;
  return { start, end };
}

function normalizeTrip(raw: Partial<Trip> & { id: string; title: string }): Trip {
  const destinations = Array.isArray(raw.destinations) && raw.destinations.length > 0
    ? raw.destinations.map((destination) => ({
        id: destination.id || uid("dest"),
        name: destination.name.trim(),
        startDate: destination.startDate?.trim() || null,
        endDate: destination.endDate?.trim() || null,
      }))
    : raw.destination || raw.startDate || raw.endDate
      ? [
          {
            id: uid("dest"),
            name: (raw.destination ?? "Destino").trim(),
            startDate: raw.startDate?.trim() || null,
            endDate: raw.endDate?.trim() || null,
          },
        ]
      : [];
  const range = tripDateRange(destinations);

  return {
    id: raw.id,
    title: raw.title,
    destinations,
    destination: destinations.map((d) => d.name).join(" → ") || null,
    startDate: range.start,
    endDate: range.end,
    notes: raw.notes ?? null,
    packItems: Array.isArray(raw.packItems)
      ? raw.packItems.map((item) => ({
          ...item,
          assigneeId:
            typeof item.assigneeId === "string" && item.assigneeId
              ? item.assigneeId
              : SHARED_ASSIGNEE,
        }))
      : [],
    stops: Array.isArray(raw.stops) ? raw.stops : [],
    docs: Array.isArray(raw.docs)
      ? raw.docs.map((doc) => ({
          ...doc,
          assigneeId:
            typeof doc.assigneeId === "string" && doc.assigneeId
              ? doc.assigneeId
              : SHARED_ASSIGNEE,
        }))
      : [],
    createdAt: raw.createdAt ?? nowIso(),
    updatedAt: raw.updatedAt ?? nowIso(),
  };
}

export function normalizeSpace(raw: DemoSpace | (Omit<DemoSpace, "trips"> & { trips?: Trip[] })): DemoSpace {
  return {
    ...raw,
    // Itens salvos no localStorage antes das categorias não têm category_id.
    items: Array.isArray(raw.items)
      ? raw.items.map((item) =>
          item.category_id ? item : { ...item, category_id: demoCategoryId(item.type) },
        )
      : [],
    trips: Array.isArray(raw.trips) ? raw.trips.map((t) => normalizeTrip(t)) : [],
  };
}

const HOUR_MS = 60 * 60 * 1000;

/** Dados de exemplo da vitrine (mockups 06, 09 e 21). */
export function sampleState(): DemoState {
  const now = Date.now();
  const at = (hoursAgo: number) => new Date(now - hoursAgo * HOUR_MS).toISOString();
  const spaceId = "space_vitrine";
  const lucas: DemoUser = { id: "user_lucas", name: "Lucas" };
  const ana: DemoUser = { id: "user_ana", name: "Ana" };

  const item = (
    input: Pick<Item, "id" | "type" | "title" | "notes"> & {
      createdAt: string;
      completedAt?: string;
    },
  ): Item => ({
    id: input.id,
    space_id: spaceId,
    type: input.type,
    category_id: demoCategoryId(input.type),
    title: input.title,
    url: null,
    notes: input.notes,
    status: input.completedAt ? "done" : "want",
    created_by: lucas.id,
    completed_at: input.completedAt ?? null,
    created_at: input.createdAt,
    updated_at: input.completedAt ?? input.createdAt,
  });

  const cantinaDoneAt = at(20);
  const items: Item[] = [
    item({
      id: "item_cafe_da_esquina",
      type: "food_idea",
      title: "Café da Esquina",
      notes: "São Paulo",
      createdAt: at(0),
    }),
    item({
      id: "item_trilha_da_pedra",
      type: "activity",
      title: "Trilha da Pedra Exemplo",
      notes: null,
      createdAt: at(2),
    }),
    item({
      id: "item_aula_de_ceramica",
      type: "activity",
      title: "Aula de cerâmica",
      notes: "No ateliê do bairro, num sábado de manhã",
      createdAt: at(8),
    }),
    item({
      id: "item_praia_do_felix",
      type: "tourist_spot",
      title: "Praia do Félix",
      notes: "Ubatuba",
      createdAt: at(26),
    }),
    item({
      id: "item_cantina_da_nonna",
      type: "restaurant",
      title: "Cantina da Nonna",
      notes: "São Paulo",
      createdAt: at(30),
      completedAt: cantinaDoneAt,
    }),
    item({
      id: "item_forro",
      type: "activity",
      title: "Aprender a dançar forró",
      notes: null,
      createdAt: at(50),
    }),
  ];

  // A demo guarda uma nota por item; nota por pessoa é do app real (PR3).
  const ratings: Rating[] = [
    {
      id: "rating_cantina_da_nonna",
      item_id: "item_cantina_da_nonna",
      rated_by: lucas.id,
      food: 9,
      service: 8,
      ambiance: 9,
      score: null,
      comment: "Massa caseira impecável, vale voltar só pelo tiramisù.",
      created_at: cantinaDoneAt,
      updated_at: cantinaDoneAt,
    },
  ];

  return {
    user: lucas,
    space: {
      id: spaceId,
      name: "Lucas & Ana",
      members: [lucas, ana],
      items,
      ratings,
      trips: [],
      updatedAt: at(0),
    },
  };
}

export function loadState(): DemoState {
  if (typeof window === "undefined") return sampleState();
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return sampleState();
    const parsed = JSON.parse(raw) as Partial<DemoState> | null;
    if (!parsed?.user || !parsed.space) return sampleState();
    return { user: parsed.user, space: normalizeSpace(parsed.space) };
  } catch {
    return sampleState();
  }
}

export function saveState(state: DemoState) {
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

export function addItem(
  space: DemoSpace,
  input: {
    type: ItemType;
    title: string;
    url?: string;
    notes?: string;
    createdBy: string;
  },
): DemoSpace {
  const stamp = nowIso();
  const item: Item = {
    id: uid("item"),
    space_id: space.id,
    type: input.type,
    category_id: demoCategoryId(input.type),
    title: input.title.trim(),
    url: input.url?.trim() || null,
    notes: input.notes?.trim() || null,
    status: "want",
    created_by: input.createdBy,
    completed_at: null,
    created_at: stamp,
    updated_at: stamp,
  };

  return {
    ...space,
    items: [item, ...space.items],
    updatedAt: stamp,
  };
}

export function upsertRating(
  space: DemoSpace,
  input: {
    itemId: string;
    ratedBy: string;
    food?: number | null;
    service?: number | null;
    ambiance?: number | null;
    score?: number | null;
  },
): DemoSpace {
  const stamp = nowIso();
  const existing = space.ratings.find((r) => r.item_id === input.itemId);
  const rating: Rating = {
    id: existing?.id ?? uid("rating"),
    item_id: input.itemId,
    rated_by: input.ratedBy,
    food: input.food ?? null,
    service: input.service ?? null,
    ambiance: input.ambiance ?? null,
    score: input.score ?? null,
    comment: null,
    created_at: existing?.created_at ?? stamp,
    updated_at: stamp,
  };

  const ratings = existing
    ? space.ratings.map((r) => (r.item_id === input.itemId ? rating : r))
    : [...space.ratings, rating];

  const items = space.items.map((item) => {
    if (item.id !== input.itemId) return item;
    return {
      ...item,
      status: "done" as ItemStatus,
      completed_at: item.completed_at ?? stamp,
      updated_at: stamp,
    };
  });

  return { ...space, items, ratings, updatedAt: stamp };
}

export function createTrip(
  space: DemoSpace,
  input: {
    title: string;
    destinations: Array<{
      name: string;
      startDate?: string;
      endDate?: string;
    }>;
    notes?: string;
  },
): DemoSpace {
  const stamp = nowIso();
  const destinations: TripDestination[] = input.destinations
    .map((destination) => ({
      id: uid("dest"),
      name: destination.name.trim(),
      startDate: destination.startDate?.trim() || null,
      endDate: destination.endDate?.trim() || null,
    }))
    .filter((destination) => destination.name.length > 0);
  if (destinations.length === 0) {
    throw new Error("Viagem precisa de pelo menos um destino");
  }
  const range = tripDateRange(destinations);
  const trip: Trip = {
    id: uid("trip"),
    title: input.title.trim(),
    destinations,
    destination: destinations.map((d) => d.name).join(" → ") || null,
    startDate: range.start,
    endDate: range.end,
    notes: input.notes?.trim() || null,
    packItems: [],
    stops: [],
    docs: [],
    createdAt: stamp,
    updatedAt: stamp,
  };

  return {
    ...space,
    trips: [trip, ...space.trips],
    updatedAt: stamp,
  };
}

function updateTrip(
  space: DemoSpace,
  tripId: string,
  updater: (trip: Trip, stamp: string) => Trip,
): DemoSpace {
  const stamp = nowIso();
  let found = false;
  const trips = space.trips.map((trip) => {
    if (trip.id !== tripId) return trip;
    found = true;
    return updater(trip, stamp);
  });
  if (!found) return space;
  return { ...space, trips, updatedAt: stamp };
}

export function addPackItem(
  space: DemoSpace,
  tripId: string,
  title: string,
  assigneeId: string = SHARED_ASSIGNEE,
): DemoSpace {
  return updateTrip(space, tripId, (trip, stamp) => {
    const item: PackItem = {
      id: uid("pack"),
      tripId,
      title: title.trim(),
      done: false,
      assigneeId: assigneeId || SHARED_ASSIGNEE,
      createdAt: stamp,
      updatedAt: stamp,
    };
    return {
      ...trip,
      packItems: [...trip.packItems, item],
      updatedAt: stamp,
    };
  });
}

export function togglePackItem(
  space: DemoSpace,
  tripId: string,
  packItemId: string,
): DemoSpace {
  return updateTrip(space, tripId, (trip, stamp) => ({
    ...trip,
    packItems: trip.packItems.map((item) =>
      item.id === packItemId
        ? { ...item, done: !item.done, updatedAt: stamp }
        : item,
    ),
    updatedAt: stamp,
  }));
}

export function removePackItem(
  space: DemoSpace,
  tripId: string,
  packItemId: string,
): DemoSpace {
  return updateTrip(space, tripId, (trip, stamp) => ({
    ...trip,
    packItems: trip.packItems.filter((item) => item.id !== packItemId),
    updatedAt: stamp,
  }));
}

export function addStop(
  space: DemoSpace,
  tripId: string,
  input: { day: number; title: string; notes?: string; url?: string },
): DemoSpace {
  return updateTrip(space, tripId, (trip, stamp) => {
    const stop: Stop = {
      id: uid("stop"),
      tripId,
      day: Math.max(1, Math.floor(input.day)),
      title: input.title.trim(),
      notes: input.notes?.trim() || null,
      url: input.url?.trim() || null,
      createdAt: stamp,
      updatedAt: stamp,
    };
    return {
      ...trip,
      stops: [...trip.stops, stop].sort((a, b) =>
        a.day === b.day
          ? a.createdAt.localeCompare(b.createdAt)
          : a.day - b.day,
      ),
      updatedAt: stamp,
    };
  });
}

export function removeStop(
  space: DemoSpace,
  tripId: string,
  stopId: string,
): DemoSpace {
  return updateTrip(space, tripId, (trip, stamp) => ({
    ...trip,
    stops: trip.stops.filter((stop) => stop.id !== stopId),
    updatedAt: stamp,
  }));
}

export function addDocLink(
  space: DemoSpace,
  tripId: string,
  input: {
    title: string;
    category: DocCategory;
    url: string;
    notes?: string;
    assigneeId?: string;
  },
): DemoSpace {
  return updateTrip(space, tripId, (trip, stamp) => {
    const doc: DocLink = {
      id: uid("doc"),
      tripId,
      title: input.title.trim(),
      category: input.category,
      url: input.url.trim(),
      notes: input.notes?.trim() || null,
      assigneeId: input.assigneeId || SHARED_ASSIGNEE,
      createdAt: stamp,
      updatedAt: stamp,
    };
    return {
      ...trip,
      docs: [doc, ...trip.docs],
      updatedAt: stamp,
    };
  });
}

export function removeDocLink(
  space: DemoSpace,
  tripId: string,
  docId: string,
): DemoSpace {
  return updateTrip(space, tripId, (trip, stamp) => ({
    ...trip,
    docs: trip.docs.filter((doc) => doc.id !== docId),
    updatedAt: stamp,
  }));
}

export function ratingForItem(space: DemoSpace, itemId: string): number | null {
  const rating = space.ratings.find((r) => r.item_id === itemId);
  if (!rating) return null;
  return displayRating(rating);
}

export function memberName(space: DemoSpace, userId: string): string {
  return space.members.find((m) => m.id === userId)?.name ?? "Alguém";
}

export function formatTripDates(trip: Trip): string | null {
  if (!trip.startDate && !trip.endDate) return null;
  if (trip.startDate && trip.endDate) return `${trip.startDate} → ${trip.endDate}`;
  return trip.startDate || trip.endDate;
}
