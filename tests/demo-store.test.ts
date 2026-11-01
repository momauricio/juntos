import { afterEach, describe, expect, it, vi } from "vitest";

import {
  DEFAULT_CATEGORIES,
  categoryItems,
  categoryScoreAverage,
  categoryTiles,
  scoreBand,
  sortCategories,
} from "@/lib/categories";
import {
  addDocLink,
  addItem,
  addPackItem,
  addStop,
  clearDemoCategories,
  countDemoCategoryItems,
  createDemoCategory,
  createTrip,
  deleteDemoCategory,
  demoCategories,
  demoCategoryId,
  demoItemImages,
  itemsWithRatings,
  loadDemoCategories,
  loadItemView,
  moveDemoCategories,
  normalizeSpace,
  ratingForItem,
  sampleState,
  reconcileItemCategories,
  saveDemoCategories,
  saveItemView,
  setItemCategory,
  tripDateRange,
  togglePackItem,
  updateDemoCategory,
  upsertRating,
  type DemoState,
} from "@/lib/demo/store";

function emptySpace(): DemoState {
  const { user, space } = sampleState();
  return { user, space: { ...space, items: [], ratings: [], trips: [] } };
}

describe("sampleState", () => {
  it("has Lucas and Ana in the space 'Lucas & Ana'", () => {
    const { user, space } = sampleState();
    expect(user.name).toBe("Lucas");
    expect(space.name).toBe("Lucas & Ana");
    expect(space.members.map((m) => m.name)).toEqual(["Lucas", "Ana"]);
    expect(space.members[0].id).toBe(user.id);
  });

  it("starts with the places and Programas from the mockups, added by Lucas", () => {
    const { user, space } = sampleState();
    expect(
      space.items.slice(0, 6).map(({ title, type, notes, status }) => ({ title, type, notes, status })),
    ).toEqual([
      { title: "Café da Esquina", type: "food_idea", notes: "São Paulo", status: "want" },
      { title: "Trilha da Pedra Exemplo", type: "activity", notes: null, status: "want" },
      {
        title: "Aula de cerâmica",
        type: "activity",
        notes: "No ateliê do bairro, num sábado de manhã",
        status: "want",
      },
      { title: "Praia do Félix", type: "tourist_spot", notes: "Ubatuba", status: "want" },
      { title: "Cantina da Nonna", type: "restaurant", notes: "São Paulo", status: "done" },
      { title: "Aprender a dançar forró", type: "activity", notes: null, status: "want" },
    ]);
    expect(space.items.slice(0, 6).every((item) => item.created_by === user.id)).toBe(true);
    expect(space.items.every((item) => item.space_id === space.id)).toBe(true);
  });

  it("has more fictitious items for the home tiles, by Lucas and Ana, some with city", () => {
    const { space } = sampleState();
    const [lucas, ana] = space.members;
    expect(space.items).toHaveLength(43);
    expect(new Set(space.items.map((item) => item.id)).size).toBe(43);
    expect(space.items.some((item) => item.created_by === ana.id)).toBe(true);
    expect(space.items.some((item) => item.created_by === lucas.id)).toBe(true);
    expect(space.items.filter((item) => item.city).length).toBeGreaterThan(5);
    // Todos os tipos aparecem em Já fizemos; Evento fica vazio em Queremos (C6).
    const doneTypes = new Set(space.items.filter((i) => i.status === "done").map((i) => i.type));
    expect(doneTypes.size).toBe(8);
    expect(space.items.some((i) => i.status === "want" && i.type === "event")).toBe(false);
  });

  it("done items have completed_at; want items don't", () => {
    const { space } = sampleState();
    for (const item of space.items) {
      expect(item.completed_at == null).toBe(item.status === "want");
    }
  });

  it("every rating points to a done item of the space", () => {
    const { space } = sampleState();
    for (const rating of space.ratings) {
      expect(space.items.find((item) => item.id === rating.item_id)?.status).toBe("done");
    }
  });

  it("has a rating for the Cantina by Lucas (9/8/9)", () => {
    const { user, space } = sampleState();
    const cantina = space.items.find((item) => item.title === "Cantina da Nonna")!;
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
    expect(sampleState().space.items).toHaveLength(43);
  });

  it("works with the store helpers", () => {
    const { user, space } = sampleState();
    const next = addItem(space, {
      type: "movie",
      title: "Filme",
      createdBy: user.id,
    });
    expect(next.items).toHaveLength(44);
    const praia = space.items.find((item) => item.title === "Praia do Félix")!;
    const rated = upsertRating(space, { itemId: praia.id, ratedBy: user.id, score: 8 });
    expect(rated.items.find((item) => item.id === praia.id)?.status).toBe("done");
  });
});

describe("demo ratings with one decimal", () => {
  it("stores decimal scores and averages them to one decimal", () => {
    const { user, space } = sampleState();
    const cantina = space.items.find((item) => item.title === "Cantina da Nonna")!;
    const rated = upsertRating(space, {
      itemId: cantina.id,
      ratedBy: user.id,
      food: 8.2,
      service: 9.3,
      ambiance: 7.5,
      score: null,
    });
    expect(rated.ratings.find((r) => r.item_id === cantina.id)).toMatchObject({
      food: 8.2,
      service: 9.3,
      ambiance: 7.5,
    });
    expect(ratingForItem(rated, cantina.id)).toBe(8.3);
  });

  it("keeps old integer ratings saved in localStorage valid", () => {
    const { space } = sampleState();
    // JSON como a demo antiga gravava: notas inteiras.
    const saved = JSON.parse(JSON.stringify(space));
    const normalized = normalizeSpace(saved);
    const cantina = normalized.items.find((item) => item.title === "Cantina da Nonna")!;
    expect(normalized.ratings[0]).toMatchObject({ food: 9, service: 8, ambiance: 9 });
    expect(ratingForItem(normalized, cantina.id)).toBe(8.7);
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

describe("demo: category_id por tipo (categorias, PR 1)", () => {
  it("todo item da vitrine e todo item novo aponta para a categoria do seu tipo", () => {
    const { user, space } = sampleState();
    for (const item of space.items) {
      expect(item.category_id).toBe(demoCategoryId(item.type));
    }
    const next = addItem(space, { type: "stay", title: "Pousada", createdBy: user.id });
    expect(next.items[0].category_id).toBe("demo-category-stay");
  });

  it("completa category_id dos itens salvos no localStorage antes das categorias", () => {
    const { space } = sampleState();
    const legacy = space.items.map((item) => {
      const copy: Partial<typeof item> = { ...item };
      delete copy.category_id;
      return copy as typeof item;
    });
    const normalized = normalizeSpace({ ...space, items: legacy });
    expect(normalized.items.map((item) => item.category_id)).toEqual(
      space.items.map((item) => `demo-category-${item.type}`),
    );
  });
});

describe("demo: categorias padrão em memória (C16)", () => {
  it("deriva as 8 categorias padrão, uma por tipo, com os ids dos itens", () => {
    const { space } = sampleState();
    const categories = demoCategories(space.id);
    expect(categories.map((c) => [c.position, c.name, c.emoji, c.color, c.item_type])).toEqual(
      DEFAULT_CATEGORIES.map((c) => [c.position, c.name, c.emoji, c.color, c.item_type]),
    );
    for (const category of categories) {
      expect(category.id).toBe(demoCategoryId(category.item_type));
      expect(category.space_id).toBe(space.id);
    }
    const ids = new Set(categories.map((c) => c.id));
    expect(space.items.every((item) => ids.has(item.category_id))).toBe(true);
  });

  it("não guarda categorias no estado salvo", () => {
    expect(Object.keys(sampleState().space)).not.toContain("categories");
  });

  it("pendura as notas nos itens, como items + ratings(*) do app", () => {
    const { space } = sampleState();
    const items = itemsWithRatings(space);
    const cantina = items.find((item) => item.title === "Cantina da Nonna")!;
    expect(cantina.ratings).toHaveLength(1);
    expect(items.find((item) => item.title === "Café da Esquina")!.ratings).toEqual([]);
  });

  it("início da vitrine: quadrados somam as abas e Restaurante tem média em Já fizemos", () => {
    const { space } = sampleState();
    const categories = demoCategories(space.id);
    const items = itemsWithRatings(space);
    for (const status of ["want", "done"] as const) {
      const sum = categoryTiles(categories, items, status).reduce((n, t) => n + t.count, 0);
      expect(sum).toBe(items.filter((item) => item.status === status).length);
    }
    const restaurant = categories.find((c) => c.item_type === "restaurant")!;
    const average = categoryScoreAverage(
      items.filter((i) => i.category_id === restaurant.id && i.status === "done"),
    );
    // 10 restaurantes com nota (Cantina 8,7, Peixaria 9,3, Empório 7,3 e os
    // 7 da tela 53) e 1 sem nota → 8,4.
    expect(average).toEqual({ value: 8.4, count: 10 });
  });
});

describe("telas 52/53 na demo", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("Hospedagem em Queremos: 5 itens, alguns com cidade, 1 com foto do Instagram", () => {
    const { space } = sampleState();
    const stay = demoCategories(space.id).find((c) => c.item_type === "stay")!;
    const items = categoryItems(itemsWithRatings(space), stay, "want");
    expect(items).toHaveLength(5);
    expect(items.filter((item) => item.city).length).toBeGreaterThanOrEqual(2);
    const images = demoItemImages(items);
    expect(Object.values(images)).toEqual([
      { url: "/demo-fotos/serra.svg", source: "instagram" },
    ]);
    // A foto é do mais novo (primeiro card da Grade, como na 52).
    expect(Object.keys(images)).toEqual([items[0].id]);
  });

  it("Restaurante em Já fizemos: ~10 itens com notas nas 4 faixas e um sem nota", () => {
    const { space } = sampleState();
    const restaurant = demoCategories(space.id).find((c) => c.item_type === "restaurant")!;
    const items = categoryItems(itemsWithRatings(space), restaurant, "done", "score");
    expect(items.length).toBeGreaterThanOrEqual(10);
    const scores = items.map((item) => ratingForItem(space, item.id));
    expect(new Set(scores.filter((s): s is number => s != null).map(scoreBand))).toEqual(
      new Set(["green", "blue", "orange", "red"]),
    );
    // Melhor nota: sem nota no fim.
    expect(scores.at(-1)).toBeNull();
  });

  it("item sem link não ganha foto", () => {
    expect(demoItemImages([{ id: "item_pousada_vale_verde", url: null }])).toEqual({});
  });

  it("Grade/Compacta fica no localStorage da demo (padrão Grade)", () => {
    expect(loadItemView()).toBe("grid");
    const store = new Map<string, string>();
    vi.stubGlobal("window", {
      localStorage: {
        getItem: (key: string) => store.get(key) ?? null,
        setItem: (key: string, value: string) => store.set(key, value),
      },
    });
    expect(loadItemView()).toBe("grid");
    saveItemView("compact");
    expect(loadItemView()).toBe("compact");
    store.set("juntos-demo-item-view", "estranho");
    expect(loadItemView()).toBe("grid");
  });
});

describe("demo: gerenciar categorias na sessão (54/55, C16)", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  const pubs = { name: "Pubs", emoji: "🍺", color: "ph5" as const };

  function setup() {
    const { user, space } = sampleState();
    return { user, space, categories: demoCategories(space.id) };
  }

  it("cria no fim da ordem, com item_type activity e quem criou", () => {
    const { user, space, categories } = setup();
    const result = createDemoCategory(categories, pubs, { spaceId: space.id, userId: user.id });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.categories).toHaveLength(9);
    expect(result.category).toMatchObject({
      name: "Pubs",
      emoji: "🍺",
      color: "ph5",
      position: 9,
      item_type: "activity",
      created_by: user.id,
      space_id: space.id,
    });
    expect(sortCategories(result.categories).at(-1)?.id).toBe(result.category.id);
  });

  it("recusa nome repetido sem acento/maiúscula, emoji duplo e o limite", () => {
    const { user, space, categories } = setup();
    const ctx = { spaceId: space.id, userId: user.id };
    expect(createDemoCategory(categories, { ...pubs, name: " hospedágem " }, ctx)).toEqual({
      ok: false,
      error: "Vocês já têm uma categoria “Hospedagem”.",
    });
    expect(createDemoCategory(categories, { ...pubs, emoji: "🍺🍻" }, ctx)).toEqual({
      ok: false,
      error: "Escolha um emoji só.",
    });
    let many = categories;
    for (let n = 0; many.length < 30; n += 1) {
      const next = createDemoCategory(many, { ...pubs, name: `Extra ${n}` }, ctx);
      if (!next.ok) throw new Error(next.error);
      many = next.categories;
    }
    expect(createDemoCategory(many, pubs, ctx)).toEqual({
      ok: false,
      error: "Vocês chegaram ao limite de 30 categorias.",
    });
  });

  it("edita nome, emoji e cor; renomear só a maiúscula pode", () => {
    const { categories } = setup();
    const stay = categories.find((c) => c.item_type === "stay")!;
    const result = updateDemoCategory(categories, stay.id, {
      name: "HOSPEDAGEM",
      emoji: "🛏️",
      color: "ph2",
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.category).toMatchObject({
      id: stay.id,
      name: "HOSPEDAGEM",
      emoji: "🛏️",
      color: "ph2",
      item_type: "stay",
      position: stay.position,
    });
    expect(
      updateDemoCategory(categories, stay.id, { name: "Cidade", emoji: "🏨", color: "ph8" }),
    ).toEqual({ ok: false, error: "Vocês já têm uma categoria “Cidade”." });
  });

  it("reordena: o 1º id fica com position 1", () => {
    const { categories } = setup();
    const ids = sortCategories(categories).map((c) => c.id);
    const moved = moveDemoCategories(categories, [ids[3], ...ids.filter((id) => id !== ids[3])]);
    expect(moved.map((c) => c.id)[0]).toBe(ids[3]);
    expect(moved.map((c) => c.position)).toEqual([1, 2, 3, 4, 5, 6, 7, 8]);
  });

  it("apaga só vazia (C1); com itens devolve os números da 55b", () => {
    const { user, space, categories } = setup();
    const stay = categories.find((c) => c.item_type === "stay")!;
    expect(countDemoCategoryItems(space, stay.id)).toEqual({ want: 5, done: 1 });
    expect(deleteDemoCategory(categories, space, stay.id)).toEqual({
      ok: false,
      reason: "not_empty",
      want: 5,
      done: 1,
    });

    const created = createDemoCategory(categories, pubs, { spaceId: space.id, userId: user.id });
    if (!created.ok) throw new Error(created.error);
    const removed = deleteDemoCategory(created.categories, space, created.category.id);
    expect(removed.ok).toBe(true);
    if (removed.ok) expect(removed.categories).toHaveLength(8);
  });

  it("mover item de categoria muda só category_id, não o type", () => {
    const { user, space, categories } = setup();
    const created = createDemoCategory(categories, pubs, { spaceId: space.id, userId: user.id });
    if (!created.ok) throw new Error(created.error);
    const restaurant = space.items.find((item) => item.type === "restaurant")!;
    const next = setItemCategory(space, restaurant.id, created.category.id);
    const moved = next.items.find((item) => item.id === restaurant.id)!;
    expect(moved.category_id).toBe(created.category.id);
    expect(moved.type).toBe("restaurant");
    expect(countDemoCategoryItems(next, created.category.id)).toEqual({
      want: restaurant.status === "want" ? 1 : 0,
      done: restaurant.status === "done" ? 1 : 0,
    });
    // Agora Pubs tem item: não apaga.
    expect(deleteDemoCategory(created.categories, next, created.category.id).ok).toBe(false);
  });

  it("item novo numa categoria criada leva o category_id dela", () => {
    const { user, space, categories } = setup();
    const created = createDemoCategory(categories, pubs, { spaceId: space.id, userId: user.id });
    if (!created.ok) throw new Error(created.error);
    const next = addItem(space, {
      type: created.category.item_type,
      categoryId: created.category.id,
      title: "Pub do Centro",
      createdBy: user.id,
    });
    expect(next.items[0]).toMatchObject({ category_id: created.category.id, type: "activity" });
  });

  it("nova sessão: item em categoria que sumiu volta para a padrão do tipo", () => {
    const { user, space, categories } = setup();
    const created = createDemoCategory(categories, pubs, { spaceId: space.id, userId: user.id });
    if (!created.ok) throw new Error(created.error);
    const item = space.items[0];
    const moved = setItemCategory(space, item.id, created.category.id);
    const fresh = reconcileItemCategories(moved, demoCategories(space.id));
    expect(fresh.items[0].category_id).toBe(demoCategoryId(item.type));
    // Tudo certo: devolve o mesmo objeto.
    expect(reconcileItemCategories(space, categories)).toBe(space);
  });

  it("categorias ficam no sessionStorage (só esta sessão); sem nada, as 8 padrão", () => {
    const store = new Map<string, string>();
    vi.stubGlobal("window", {
      sessionStorage: {
        getItem: (key: string) => store.get(key) ?? null,
        setItem: (key: string, value: string) => store.set(key, value),
        removeItem: (key: string) => store.delete(key),
      },
    });
    const { user, space, categories } = setup();
    expect(loadDemoCategories(space.id)).toHaveLength(8);
    const created = createDemoCategory(categories, pubs, { spaceId: space.id, userId: user.id });
    if (!created.ok) throw new Error(created.error);
    saveDemoCategories(created.categories);
    expect(loadDemoCategories(space.id).map((c) => c.name)).toContain("Pubs");
    clearDemoCategories();
    expect(loadDemoCategories(space.id)).toHaveLength(8);
  });
});
