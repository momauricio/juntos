import { generateInviteCode } from "@/lib/invites";
import { displayRating } from "@/lib/ratings";
import type { Item, ItemStatus, ItemType, Rating } from "@/lib/types";

export type DemoUser = {
  id: string;
  name: string;
};

export type DemoSpace = {
  id: string;
  name: string;
  inviteCode: string;
  members: DemoUser[];
  items: Item[];
  ratings: Rating[];
  updatedAt: string;
};

export type DemoState = {
  user: DemoUser | null;
  space: DemoSpace | null;
};

const STORAGE_KEY = "juntos-demo-v1";

function nowIso() {
  return new Date().toISOString();
}

function uid(prefix: string) {
  return `${prefix}_${Math.random().toString(36).slice(2, 10)}${Date.now().toString(36)}`;
}

export function emptyState(): DemoState {
  return { user: null, space: null };
}

export function loadState(): DemoState {
  if (typeof window === "undefined") return emptyState();
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return emptyState();
    return JSON.parse(raw) as DemoState;
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

export function mergeSpaces(local: DemoSpace, incoming: DemoSpace): DemoSpace {
  const membersById = new Map<string, DemoUser>();
  [...local.members, ...incoming.members].forEach((m) => membersById.set(m.id, m));

  const itemsById = new Map<string, Item>();
  [...local.items, ...incoming.items].forEach((item) => {
    const prev = itemsById.get(item.id);
    if (!prev || prev.updated_at <= item.updated_at) itemsById.set(item.id, item);
  });

  const ratingsByItem = new Map<string, Rating>();
  [...local.ratings, ...incoming.ratings].forEach((rating) => {
    const prev = ratingsByItem.get(rating.item_id);
    if (!prev || prev.updated_at <= rating.updated_at) {
      ratingsByItem.set(rating.item_id, rating);
    }
  });

  return {
    id: local.id || incoming.id,
    name: local.name || incoming.name,
    inviteCode: local.inviteCode || incoming.inviteCode,
    members: Array.from(membersById.values()).slice(0, 2),
    items: Array.from(itemsById.values()).sort((a, b) =>
      a.created_at < b.created_at ? 1 : -1,
    ),
    ratings: Array.from(ratingsByItem.values()),
    updatedAt: nowIso(),
  };
}

export function encodeSpace(space: DemoSpace): string {
  const json = JSON.stringify(space);
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
    return JSON.parse(json) as DemoSpace;
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
