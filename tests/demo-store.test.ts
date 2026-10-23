import { describe, expect, it } from "vitest";

import {
  addDocLink,
  addItem,
  addPackItem,
  addStop,
  createTrip,
  normalizeSpace,
  ratingForItem,
  sampleState,
  tripDateRange,
  togglePackItem,
  upsertRating,
  type DemoState,
} from "@/lib/demo/store";

function emptySpace(): DemoState {
  const { user, space } = sampleState();
  return { user, space: { ...space, items: [], ratings: [], trips: [] } };
}

describe("sampleState", () => {
  it("has Mauricio and Ana in the space 'Mauricio & Ana'", () => {
    const { user, space } = sampleState();
    expect(user.name).toBe("Mauricio");
    expect(space.name).toBe("Mauricio & Ana");
    expect(space.members.map((m) => m.name)).toEqual(["Mauricio", "Ana"]);
    expect(space.members[0].id).toBe(user.id);
  });

  it("has the 3 places from the mockups, all added by Mauricio", () => {
    const { user, space } = sampleState();
    expect(
      space.items.map(({ title, type, notes, status }) => ({ title, type, notes, status })),
    ).toEqual([
      { title: "Café da Esquina", type: "food_idea", notes: "São Paulo", status: "want" },
      { title: "Praia do Félix", type: "tourist_spot", notes: "Ubatuba", status: "want" },
      { title: "Cantina da Nonna", type: "restaurant", notes: "São Paulo", status: "done" },
    ]);
    expect(space.items.every((item) => item.created_by === user.id)).toBe(true);
    expect(space.items.every((item) => item.space_id === space.id)).toBe(true);
  });

  it("marks only the Cantina as done, with completed_at", () => {
    const { space } = sampleState();
    for (const item of space.items) {
      if (item.title === "Cantina da Nonna") {
        expect(item.completed_at).not.toBeNull();
      } else {
        expect(item.completed_at).toBeNull();
      }
    }
  });

  it("has one rating for the Cantina by Mauricio (9/8/9)", () => {
    const { user, space } = sampleState();
    const cantina = space.items.find((item) => item.title === "Cantina da Nonna")!;
    expect(space.ratings).toHaveLength(1);
    expect(space.ratings[0]).toMatchObject({
      item_id: cantina.id,
      rated_by: user.id,
      food: 9,
      service: 8,
      ambiance: 9,
      score: null,
    });
    expect(ratingForItem(space, cantina.id)).not.toBeNull();
  });

  it("returns a fresh copy each time", () => {
    const first = sampleState();
    first.space.items.pop();
    expect(sampleState().space.items).toHaveLength(3);
  });

  it("works with the store helpers", () => {
    const { user, space } = sampleState();
    const next = addItem(space, {
      type: "movie",
      title: "Filme",
      createdBy: user.id,
    });
    expect(next.items).toHaveLength(4);
    const praia = space.items.find((item) => item.title === "Praia do Félix")!;
    const rated = upsertRating(space, { itemId: praia.id, ratedBy: user.id, score: 8 });
    expect(rated.items.find((item) => item.id === praia.id)?.status).toBe("done");
  });
});

describe("demo trips", () => {
  it("creates trip with checklist, stops and docs", () => {
    const { user, space: empty } = emptySpace();
    let space = empty;
    space = createTrip(space, {
      title: "Chile 2026",
      destinations: [
        {
          name: "Santiago",
          startDate: "2026-09-01",
          endDate: "2026-09-10",
        },
      ],
    });
    const tripId = space.trips[0].id;

    space = addPackItem(space, tripId, "Passaporte", user.id);
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
      assigneeId: user.id,
    });

    expect(space.trips).toHaveLength(1);
    expect(space.trips[0].title).toBe("Chile 2026");
    expect(space.trips[0].packItems[0].done).toBe(true);
    expect(space.trips[0].packItems[0].assigneeId).toBe(user.id);
    expect(space.trips[0].stops[0].day).toBe(1);
    expect(space.trips[0].docs[0].category).toBe("flight");
    expect(space.trips[0].docs[0].assigneeId).toBe(user.id);
  });

  it("normalizes legacy pack/docs without assigneeId to shared", () => {
    const { space: empty } = emptySpace();
    let space = empty;
    space = createTrip(space, {
      title: "Chile",
      destinations: [{ name: "Santiago" }],
    });
    const legacy = {
      ...space,
      trips: [
        {
          ...space.trips[0],
          packItems: [
            {
              id: "pack_1",
              tripId: space.trips[0].id,
              title: "Meia",
              done: false,
              createdAt: "2026-01-01T00:00:00.000Z",
              updatedAt: "2026-01-01T00:00:00.000Z",
            },
          ],
          docs: [
            {
              id: "doc_1",
              tripId: space.trips[0].id,
              title: "Hotel",
              category: "reservation" as const,
              url: "https://example.com",
              notes: null,
              createdAt: "2026-01-01T00:00:00.000Z",
              updatedAt: "2026-01-01T00:00:00.000Z",
            },
          ],
        },
      ],
    };
    const normalized = normalizeSpace(legacy as never);
    expect(normalized.trips[0].packItems[0].assigneeId).toBe("shared");
    expect(normalized.trips[0].docs[0].assigneeId).toBe("shared");
  });

  it("normalizes legacy spaces without trips", () => {
    const legacy = {
      id: "space_1",
      name: "Nós dois",
      inviteCode: "ABCD1234",
      members: [{ id: "u1", name: "A" }],
      items: [],
      ratings: [],
      updatedAt: new Date().toISOString(),
    };

    expect(normalizeSpace(legacy as never).trips).toEqual([]);
  });
});

describe("trip destinations", () => {
  it("computes total range from multiple destinations", () => {
    expect(
      tripDateRange([
        { id: "a", name: "SP", startDate: "2026-12-20", endDate: "2026-12-22" },
        { id: "b", name: "Nordeste", startDate: "2026-12-22", endDate: "2026-12-30" },
      ]),
    ).toEqual({ start: "2026-12-20", end: "2026-12-30" });
  });

  it("creates trip with ordered destinations and derived dates", () => {
    const { space: empty } = emptySpace();
    let space = empty;
    space = createTrip(space, {
      title: "Nordeste final do ano",
      destinations: [
        { name: "SP", startDate: "2026-12-20", endDate: "2026-12-22" },
        { name: "Nordeste", startDate: "2026-12-22", endDate: "2026-12-30" },
      ],
    });
    const trip = space.trips[0];
    expect(trip.destinations.map((d) => d.name)).toEqual(["SP", "Nordeste"]);
    expect(trip.startDate).toBe("2026-12-20");
    expect(trip.endDate).toBe("2026-12-30");
  });

  it("normalizes legacy single destination into destinations[]", () => {
    const { space } = emptySpace();
    const legacy = {
      ...space,
      trips: [
        {
          id: "trip_legacy",
          title: "Chile",
          destination: "Santiago",
          startDate: "2026-08-01",
          endDate: "2026-08-10",
          notes: null,
          packItems: [],
          stops: [],
          docs: [],
          createdAt: "2026-01-01T00:00:00.000Z",
          updatedAt: "2026-01-01T00:00:00.000Z",
        },
      ],
    };
    const normalized = normalizeSpace(legacy as never);
    expect(normalized.trips[0].destinations).toHaveLength(1);
    expect(normalized.trips[0].destinations[0].name).toBe("Santiago");
  });
});
