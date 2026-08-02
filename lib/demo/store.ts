import { generateInviteCode } from "@/lib/invites";
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
  createdAt: string;
  updatedAt: string;
};

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
  inviteCode: string;
  members: DemoUser[];
  items: Item[];
  ratings: Rating[];
  trips: Trip[];
  updatedAt: string;
};

export type DemoState = {
  user: DemoUser | null;
  space: DemoSpace | null;
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
    packItems: Array.isArray(raw.packItems) ? raw.packItems : [],
    stops: Array.isArray(raw.stops) ? raw.stops : [],
    docs: Array.isArray(raw.docs) ? raw.docs : [],
    createdAt: raw.createdAt ?? nowIso(),
    updatedAt: raw.updatedAt ?? nowIso(),
  };
}

export function normalizeSpace(raw: DemoSpace | (Omit<DemoSpace, "trips"> & { trips?: Trip[] })): DemoSpace {
  return {
    ...raw,
    trips: Array.isArray(raw.trips) ? raw.trips.map((t) => normalizeTrip(t)) : [],
  };
}

export function emptyState(): DemoState {
  return { user: null, space: null };
}

export function loadState(): DemoState {
  if (typeof window === "undefined") return emptyState();
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return emptyState();
    const parsed = JSON.parse(raw) as DemoState;
    if (parsed.space) {
      return { ...parsed, space: normalizeSpace(parsed.space) };
    }
    return parsed;
  } catch {
    return emptyState();
  }
}

export function saveState(state: DemoState) {
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

export function createUser(name: string): DemoUser {
  return { id: uid("user"), name: name.trim() || "Eu" };
}

export function createSpace(owner: DemoUser, name = "Nós dois"): DemoSpace {
  return {
    id: uid("space"),
    name,
    inviteCode: generateInviteCode(),
    members: [owner],
    items: [],
    ratings: [],
    trips: [],
    updatedAt: nowIso(),
  };
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
): DemoSpace {
  return updateTrip(space, tripId, (trip, stamp) => {
    const item: PackItem = {
      id: uid("pack"),
      tripId,
      title: title.trim(),
      done: false,
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

function mergeByUpdatedAt<T extends { id: string; updatedAt: string }>(
  local: T[],
  incoming: T[],
): T[] {
  const map = new Map<string, T>();
  [...local, ...incoming].forEach((entry) => {
    const prev = map.get(entry.id);
    if (!prev || prev.updatedAt <= entry.updatedAt) map.set(entry.id, entry);
  });
  return Array.from(map.values());
}

function mergeTrips(local: Trip[], incoming: Trip[]): Trip[] {
  const byId = new Map<string, Trip>();
  [...local, ...incoming].forEach((trip) => {
    const normalized = normalizeTrip(trip);
    const prev = byId.get(normalized.id);
    if (!prev) {
      byId.set(normalized.id, normalized);
      return;
    }
    const newer = prev.updatedAt <= normalized.updatedAt ? normalized : prev;
    const older = newer === normalized ? prev : normalized;
    byId.set(normalized.id, {
      ...newer,
      packItems: mergeByUpdatedAt(older.packItems, newer.packItems),
      stops: mergeByUpdatedAt(older.stops, newer.stops).sort((a, b) =>
        a.day === b.day
          ? a.createdAt.localeCompare(b.createdAt)
          : a.day - b.day,
      ),
      docs: mergeByUpdatedAt(older.docs, newer.docs),
    });
  });
  return Array.from(byId.values()).sort((a, b) =>
    a.createdAt < b.createdAt ? 1 : -1,
  );
}

export function mergeSpaces(local: DemoSpace, incoming: DemoSpace): DemoSpace {
  const left = normalizeSpace(local);
  const right = normalizeSpace(incoming);

  const membersById = new Map<string, DemoUser>();
  [...left.members, ...right.members].forEach((m) => membersById.set(m.id, m));

  const itemsById = new Map<string, Item>();
  [...left.items, ...right.items].forEach((item) => {
    const prev = itemsById.get(item.id);
    if (!prev || prev.updated_at <= item.updated_at) itemsById.set(item.id, item);
  });

  const ratingsByItem = new Map<string, Rating>();
  [...left.ratings, ...right.ratings].forEach((rating) => {
    const prev = ratingsByItem.get(rating.item_id);
    if (!prev || prev.updated_at <= rating.updated_at) {
      ratingsByItem.set(rating.item_id, rating);
    }
  });

  return {
    id: left.id || right.id,
    name: left.name || right.name,
    inviteCode: left.inviteCode || right.inviteCode,
    members: Array.from(membersById.values()).slice(0, 2),
    items: Array.from(itemsById.values()).sort((a, b) =>
      a.created_at < b.created_at ? 1 : -1,
    ),
    ratings: Array.from(ratingsByItem.values()),
    trips: mergeTrips(left.trips, right.trips),
    updatedAt: nowIso(),
  };
}

export function encodeSpace(space: DemoSpace): string {
  const json = JSON.stringify(normalizeSpace(space));
  const bytes = new TextEncoder().encode(json);
  let binary = "";
  bytes.forEach((b) => {
    binary += String.fromCharCode(b);
  });
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

export function decodeSpace(payload: string): DemoSpace | null {
  try {
    const padded = payload.replace(/-/g, "+").replace(/_/g, "/");
    const pad = padded.length % 4 === 0 ? "" : "=".repeat(4 - (padded.length % 4));
    const binary = atob(padded + pad);
    const bytes = Uint8Array.from(binary, (c) => c.charCodeAt(0));
    const json = new TextDecoder().decode(bytes);
    return normalizeSpace(JSON.parse(json) as DemoSpace);
  } catch {
    return null;
  }
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
