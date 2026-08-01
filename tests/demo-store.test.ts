import { describe, expect, it } from "vitest";

import {
  addDocLink,
  addItem,
  addPackItem,
  addStop,
  createSpace,
  createTrip,
  createUser,
  decodeSpace,
  encodeSpace,
  mergeSpaces,
  togglePackItem,
} from "@/lib/demo/store";

describe("demo sync encode/decode", () => {
  it("round-trips a space payload", () => {
    const user = createUser("Mauricio");
    let space = createSpace(user);
    space = addItem(space, {
      type: "restaurant",
      title: "Pizza da esquina",
      createdBy: user.id,
    });

    const encoded = encodeSpace(space);
    const decoded = decodeSpace(encoded);
    expect(decoded?.items[0]?.title).toBe("Pizza da esquina");
    expect(decoded?.members[0]?.name).toBe("Mauricio");
    expect(decoded?.trips).toEqual([]);
  });

  it("merges items from two spaces by updated_at", () => {
    const a = createUser("A");
    const b = createUser("B");
    let left = createSpace(a);
    left = addItem(left, {
      type: "movie",
      title: "Filme A",
      createdBy: a.id,
    });
    let right = { ...left, members: [...left.members, b] };
    right = addItem(right, {
      type: "city",
      title: "Lisboa",
      createdBy: b.id,
    });

    const merged = mergeSpaces(left, right);
    expect(merged.items).toHaveLength(2);
    expect(merged.members).toHaveLength(2);
  });
});

describe("demo trips", () => {
  it("creates trip with checklist, stops and docs and round-trips sync", () => {
    const user = createUser("Mauricio");
    let space = createSpace(user);
    space = createTrip(space, {
      title: "Chile 2026",
      destination: "Santiago",
      startDate: "2026-09-01",
      endDate: "2026-09-10",
    });
    const tripId = space.trips[0].id;

    space = addPackItem(space, tripId, "Passaporte");
    space = togglePackItem(space, tripId, space.trips[0].packItems[0].id);
    space = addStop(space, tripId, {
      day: 1,
      title: "Cerro San Cristóbal",
      url: "https://example.com",
    });
    space = addDocLink(space, tripId, {
      title: "LATAM ida",
      category: "flight",
      url: "https://latam.example/ticket",
    });

    const decoded = decodeSpace(encodeSpace(space));
    expect(decoded?.trips).toHaveLength(1);
    expect(decoded?.trips[0].title).toBe("Chile 2026");
    expect(decoded?.trips[0].packItems[0].done).toBe(true);
    expect(decoded?.trips[0].stops[0].day).toBe(1);
    expect(decoded?.trips[0].docs[0].category).toBe("flight");
  });

  it("merges trip nested entities by updatedAt", () => {
    const user = createUser("A");
    let left = createSpace(user);
    left = createTrip(left, { title: "Chile 2026" });
    const tripId = left.trips[0].id;
    left = addPackItem(left, tripId, "Carregador");

    let right = structuredClone(left);
    right = addStop(right, tripId, { day: 2, title: "Valparaíso" });
    right = addDocLink(right, tripId, {
      title: "Hotel",
      category: "reservation",
      url: "https://booking.example",
    });

    const merged = mergeSpaces(left, right);
    expect(merged.trips).toHaveLength(1);
    expect(merged.trips[0].packItems).toHaveLength(1);
    expect(merged.trips[0].stops).toHaveLength(1);
    expect(merged.trips[0].docs).toHaveLength(1);
  });

  it("normalizes legacy spaces without trips on decode", () => {
    const legacy = {
      id: "space_1",
      name: "Nós dois",
      inviteCode: "ABCD1234",
      members: [{ id: "u1", name: "A" }],
      items: [],
      ratings: [],
      updatedAt: new Date().toISOString(),
    };
    const json = JSON.stringify(legacy);
    const bytes = new TextEncoder().encode(json);
    let binary = "";
    bytes.forEach((b) => {
      binary += String.fromCharCode(b);
    });
    const encoded = btoa(binary)
      .replace(/\+/g, "-")
      .replace(/\//g, "_")
      .replace(/=+$/g, "");

    const decoded = decodeSpace(encoded);
    expect(decoded?.trips).toEqual([]);
  });
});
