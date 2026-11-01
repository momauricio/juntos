import {
  CATEGORY_UNKNOWN_ERROR,
  categoryNameKey,
  CUSTOM_CATEGORY_ITEM_TYPE,
  DEFAULT_CATEGORIES,
  defaultCategoryForType,
  gridPhotoSource,
  nextCategoryPosition,
  parseItemView,
  sortCategories,
  validateCategoryInput,
  type CategoryCounts,
  type CategoryInput,
} from "@/lib/categories";
import { displayRating } from "@/lib/ratings";
import type {
  Category,
  Item,
  ItemStatus,
  ItemType,
  ItemView,
  Rating,
} from "@/lib/types";

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
// Grade/Compacta de quem usa a demo (no app, profiles.item_view).
const ITEM_VIEW_STORAGE_KEY = "juntos-demo-item-view";

function nowIso() {
  return new Date().toISOString();
}

// A demo ainda não tem categorias de verdade: cada item aponta para a categoria
// padrão do seu tipo, com id fixo (sem mudar nada na tela).
export function demoCategoryId(type: ItemType): string {
  return `demo-category-${type}`;
}

// As 8 categorias padrão (C16), derivadas dos tipos, em memória: nada vai
// para o localStorage nem para o banco.
const DEMO_CATEGORY_CREATED_AT = "2026-01-01T00:00:00.000Z";

export function demoCategories(spaceId: string): Category[] {
  return DEFAULT_CATEGORIES.map((category) => ({
    ...category,
    id: demoCategoryId(category.item_type),
    space_id: spaceId,
    name_key: categoryNameKey(category.name),
    created_by: null,
    created_at: DEMO_CATEGORY_CREATED_AT,
    updated_at: DEMO_CATEGORY_CREATED_AT,
  }));
}

// Itens com as notas penduradas (mesmo formato do app: items + ratings(*)).
export function itemsWithRatings(space: DemoSpace): Array<Item & { ratings: Rating[] }> {
  return space.items.map((item) => ({
    ...item,
    ratings: space.ratings.filter((rating) => rating.item_id === item.id),
  }));
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
    // Itens salvos no localStorage antes das categorias não têm category_id
    // (nem city, que a demo não usa).
    items: Array.isArray(raw.items)
      ? raw.items.map((item) => ({
          ...item,
          category_id: item.category_id || demoCategoryId(item.type),
          city: item.city ?? null,
        }))
      : [],
    trips: Array.isArray(raw.trips) ? raw.trips.map((t) => normalizeTrip(t)) : [],
  };
}

const HOUR_MS = 60 * 60 * 1000;

type SampleExtra = {
  id: string;
  type: ItemType;
  title: string;
  city?: string;
  byAna?: boolean;
  daysAgo: number;
  url?: string;
  // Já fizemos: há quantos dias; com nota: [comida, atendimento, ambiente] ou [nota].
  doneDaysAgo?: number;
  rating?: [number, number, number] | [number];
};

// Itens fictícios extras da vitrine: todas as categorias com alguma coisa,
// cidades em parte deles e notas em Já fizemos (Evento fica vazio em Queremos).
const SAMPLE_EXTRA: SampleExtra[] = [
  // Hospedagem em Queremos: a tela 52 (5 itens, 2 com cidade, 1 com link do Instagram e foto).
  { id: "item_pousada_vale_verde", type: "stay", title: "Pousada Vale Verde", city: "Gonçalves", daysAgo: 3, url: "https://www.instagram.com/p/DemoValeVerde/" },
  { id: "item_cabana_do_lago", type: "stay", title: "Cabana do Lago", byAna: true, daysAgo: 9 },
  { id: "item_chale_da_serra", type: "stay", title: "Chalé da Serra", byAna: true, daysAgo: 21 },
  { id: "item_eco_refugio", type: "stay", title: "Eco Refúgio Araucária", byAna: true, daysAgo: 27 },
  { id: "item_hotel_bela_vista", type: "stay", title: "Hotel Bela Vista", city: "São Bento do Sul", byAna: true, daysAgo: 33 },
  { id: "item_bistro_da_praca", type: "restaurant", title: "Bistrô da Praça", city: "Curitiba", byAna: true, daysAgo: 4 },
  { id: "item_sushi_do_porto", type: "restaurant", title: "Sushi do Porto", city: "Santos", daysAgo: 7 },
  { id: "item_taberna_velha", type: "restaurant", title: "Taberna Velha", byAna: true, daysAgo: 15 },
  { id: "item_forno_a_lenha", type: "restaurant", title: "Pizzaria Forno a Lenha", daysAgo: 28 },
  { id: "item_mirante_do_pico", type: "tourist_spot", title: "Mirante do Pico", city: "Campos do Jordão", byAna: true, daysAgo: 6 },
  { id: "item_cachoeira_veu_azul", type: "tourist_spot", title: "Cachoeira Véu Azul", daysAgo: 18 },
  { id: "item_piquenique", type: "activity", title: "Piquenique no parque", byAna: true, daysAgo: 5 },
  { id: "item_bolo_de_fuba", type: "food_idea", title: "Bolo de fubá da vó", byAna: true, daysAgo: 11 },
  { id: "item_paraty", type: "city", title: "Paraty", byAna: true, daysAgo: 8 },
  { id: "item_tiradentes", type: "city", title: "Tiradentes", daysAgo: 24 },
  { id: "item_cinema_paradiso", type: "movie", title: "Cinema Paradiso", daysAgo: 10 },
  { id: "item_amelie", type: "movie", title: "O fabuloso destino de Amélie", byAna: true, daysAgo: 16 },
  // Já fizemos
  { id: "item_peixaria_do_cais", type: "restaurant", title: "Peixaria do Cais", city: "Florianópolis", byAna: true, daysAgo: 40, doneDaysAgo: 3, rating: [9.5, 9, 9.5] },
  { id: "item_emporio_mineiro", type: "restaurant", title: "Empório Mineiro", city: "Belo Horizonte", daysAgo: 60, doneDaysAgo: 12, rating: [7, 8, 7] },
  { id: "item_hamburgueria_22", type: "restaurant", title: "Hamburgueria 22", daysAgo: 70, doneDaysAgo: 30 },
  // Mais restaurantes em Já fizemos: a tela 53 (notas nas 4 faixas e empates).
  { id: "item_sushi_kaze", type: "restaurant", title: "Sushi Kaze", city: "Gramado", daysAgo: 150, doneDaysAgo: 100, rating: [9.5, 10, 9.5] },
  { id: "item_trattoria_bella", type: "restaurant", title: "Trattoria Bella", byAna: true, daysAgo: 140, doneDaysAgo: 90, rating: [9.5, 9, 9.5] },
  { id: "item_taqueria_la_lupe", type: "restaurant", title: "Taquería La Lupe 🇲🇽", daysAgo: 130, doneDaysAgo: 80, rating: [9, 9, 9.5] },
  { id: "item_bodega_andina", type: "restaurant", title: "Bodega Andina 🇦🇷", byAna: true, daysAgo: 125, doneDaysAgo: 75, rating: [9, 8.5, 9] },
  { id: "item_cafe_colonial", type: "restaurant", title: "Café Colonial da Vó", city: "Gramado", byAna: true, daysAgo: 115, doneDaysAgo: 66, rating: [8, 8.5, 8] },
  { id: "item_churrascaria_gaucha", type: "restaurant", title: "Churrascaria Gaúcha", daysAgo: 110, doneDaysAgo: 58, rating: [8, 7, 7.5] },
  { id: "item_pastelaria_da_feira", type: "restaurant", title: "Pastelaria da Feira", byAna: true, daysAgo: 105, doneDaysAgo: 50, rating: [6, 7, 6] },
  { id: "item_jardim_botanico", type: "tourist_spot", title: "Jardim Botânico", city: "Curitiba", byAna: true, daysAgo: 45, doneDaysAgo: 5, rating: [9] },
  { id: "item_trilha_do_morro", type: "tourist_spot", title: "Trilha do Morro", daysAgo: 80, doneDaysAgo: 40 },
  { id: "item_aula_de_vinho", type: "activity", title: "Aula de vinho", byAna: true, daysAgo: 50, doneDaysAgo: 8, rating: [8.5] },
  { id: "item_boliche", type: "activity", title: "Boliche de sexta", daysAgo: 90, doneDaysAgo: 20 },
  { id: "item_panqueca", type: "food_idea", title: "Panqueca de domingo", byAna: true, daysAgo: 35, doneDaysAgo: 14, rating: [8] },
  { id: "item_cidade_de_deus", type: "movie", title: "Cidade de Deus", daysAgo: 55, doneDaysAgo: 9, rating: [9.6] },
  { id: "item_auto_da_compadecida", type: "movie", title: "O Auto da Compadecida", byAna: true, daysAgo: 65, doneDaysAgo: 25, rating: [9.2] },
  { id: "item_ouro_preto", type: "city", title: "Ouro Preto", daysAgo: 120, doneDaysAgo: 60, rating: [8.8] },
  { id: "item_hotel_fazenda_sol", type: "stay", title: "Hotel Fazenda Sol", city: "Atibaia", byAna: true, daysAgo: 100, doneDaysAgo: 45 },
  { id: "item_festival_de_jazz", type: "event", title: "Festival de Jazz", city: "Rio das Ostras", daysAgo: 75, doneDaysAgo: 33, rating: [9.4] },
];

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
      city?: string;
      url?: string;
      by?: DemoUser;
    },
  ): Item => ({
    id: input.id,
    space_id: spaceId,
    type: input.type,
    category_id: demoCategoryId(input.type),
    title: input.title,
    url: input.url ?? null,
    notes: input.notes,
    city: input.city ?? null,
    status: input.completedAt ? "done" : "want",
    created_by: (input.by ?? lucas).id,
    completed_at: input.completedAt ?? null,
    created_at: input.createdAt,
    updated_at: input.completedAt ?? input.createdAt,
  });

  const cantinaDoneAt = at(20);
  const DAY = 24;
  // Os 6 primeiros são os da vitrine de sempre (mockups 06, 09 e 21).
  const items: Item[] = [
    item({
      id: "item_cafe_da_esquina",
      type: "food_idea",
      title: "Café da Esquina",
      notes: "São Paulo",
      city: "São Paulo",
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
      city: "Ubatuba",
      createdAt: at(26),
    }),
    item({
      id: "item_cantina_da_nonna",
      type: "restaurant",
      title: "Cantina da Nonna",
      notes: "São Paulo",
      city: "São Paulo",
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
    // Mais exemplos (fictícios) para os quadrados do início (telas 50/51).
    ...SAMPLE_EXTRA.map((extra) =>
      item({
        id: extra.id,
        type: extra.type,
        title: extra.title,
        notes: null,
        city: extra.city,
        url: extra.url,
        by: extra.byAna ? ana : lucas,
        createdAt: at(extra.daysAgo * DAY),
        completedAt: extra.doneDaysAgo != null ? at(extra.doneDaysAgo * DAY) : undefined,
      }),
    ),
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
    ...SAMPLE_EXTRA.filter((extra) => extra.rating).map((extra): Rating => {
      const stamp = at((extra.doneDaysAgo ?? 0) * DAY);
      const [food, service, ambiance] =
        extra.rating && extra.rating.length === 3 ? extra.rating : [null, null, null];
      return {
        id: `rating_${extra.id.slice("item_".length)}`,
        item_id: extra.id,
        rated_by: extra.byAna ? ana.id : lucas.id,
        food,
        service,
        ambiance,
        score: extra.rating && extra.rating.length === 1 ? extra.rating[0] : null,
        comment: null,
        created_at: stamp,
        updated_at: stamp,
      };
    }),
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

// "Fotos" do link de alguns itens da vitrine (os itens não guardam imagem;
// no app, sem foto, o card fica com a cor + emoji da categoria).
const DEMO_PHOTOS: Record<string, string> = {
  item_pousada_vale_verde: "/demo-fotos/serra.svg",
};

// Foto e selo ("📸 Instagram"/"📸 link") por item, para a Grade.
export function demoItemImages(
  items: readonly Pick<Item, "id" | "url">[],
): Record<string, { url: string; source: "instagram" | "link" }> {
  const images: Record<string, { url: string; source: "instagram" | "link" }> = {};
  for (const item of items) {
    const photo = DEMO_PHOTOS[item.id];
    if (photo && item.url) images[item.id] = { url: photo, source: gridPhotoSource(item.url) };
  }
  return images;
}

export function loadItemView(): ItemView {
  if (typeof window === "undefined") return "grid";
  try {
    return parseItemView(window.localStorage.getItem(ITEM_VIEW_STORAGE_KEY));
  } catch {
    return "grid";
  }
}

export function saveItemView(view: ItemView) {
  try {
    window.localStorage.setItem(ITEM_VIEW_STORAGE_KEY, view);
  } catch {
    // Sem localStorage (aba anônima cheia): vale só nesta sessão.
  }
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
    // Categoria escolhida (o type vem dela); sem isso, a padrão do tipo.
    categoryId?: string;
  },
): DemoSpace {
  const stamp = nowIso();
  const item: Item = {
    id: uid("item"),
    space_id: space.id,
    type: input.type,
    category_id: input.categoryId ?? demoCategoryId(input.type),
    title: input.title.trim(),
    url: input.url?.trim() || null,
    notes: input.notes?.trim() || null,
    city: null,
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

// ---------------------------------------------------------------------------
// Gerenciar categorias na demo (telas 54/55, C16): vale só nesta sessão do
// navegador (sessionStorage), sem banco. As mesmas regras do app: nome único
// sem acento/maiúscula, 1 emoji, paleta P, até 30, apagar só vazia.

const CATEGORIES_SESSION_KEY = "juntos-demo-categories-v1";

export function loadDemoCategories(spaceId: string): Category[] {
  if (typeof window === "undefined") return demoCategories(spaceId);
  try {
    const raw = window.sessionStorage.getItem(CATEGORIES_SESSION_KEY);
    const parsed = raw ? (JSON.parse(raw) as Category[] | null) : null;
    return Array.isArray(parsed) && parsed.length > 0
      ? sortCategories(parsed)
      : demoCategories(spaceId);
  } catch {
    return demoCategories(spaceId);
  }
}

export function saveDemoCategories(categories: Category[]) {
  try {
    window.sessionStorage.setItem(CATEGORIES_SESSION_KEY, JSON.stringify(categories));
  } catch {
    // Sem sessionStorage: vale só enquanto a página está aberta.
  }
}

export function clearDemoCategories() {
  try {
    window.sessionStorage.removeItem(CATEGORIES_SESSION_KEY);
  } catch {
    // nada a limpar
  }
}

// Item que aponta para uma categoria que não existe nesta sessão (ex.: movido
// para "Pubs" numa sessão anterior) volta para a padrão do seu tipo.
export function reconcileItemCategories(space: DemoSpace, categories: Category[]): DemoSpace {
  const ids = new Set(categories.map((category) => category.id));
  if (space.items.every((item) => ids.has(item.category_id))) return space;
  const fallback = sortCategories(categories)[0]?.id;
  return {
    ...space,
    items: space.items.map((item) =>
      ids.has(item.category_id)
        ? item
        : {
            ...item,
            category_id:
              defaultCategoryForType(categories, item.type)?.id ?? fallback ?? item.category_id,
          },
    ),
  };
}

type DemoCategoryResult =
  | { ok: true; categories: Category[]; category: Category }
  | { ok: false; error: string };

// C4: no fim da ordem, item_type 'activity'.
export function createDemoCategory(
  categories: Category[],
  input: CategoryInput,
  context: { spaceId: string; userId: string },
): DemoCategoryResult {
  const problem = validateCategoryInput(input, categories);
  if (problem) return { ok: false, error: problem };
  const stamp = nowIso();
  const name = input.name.trim();
  const category: Category = {
    id: uid("category"),
    space_id: context.spaceId,
    name,
    name_key: categoryNameKey(name),
    emoji: input.emoji.trim(),
    color: input.color,
    position: nextCategoryPosition(categories),
    item_type: CUSTOM_CATEGORY_ITEM_TYPE,
    created_by: context.userId,
    created_at: stamp,
    updated_at: stamp,
  };
  return { ok: true, categories: [...categories, category], category };
}

export function updateDemoCategory(
  categories: Category[],
  id: string,
  input: CategoryInput,
): DemoCategoryResult {
  const current = categories.find((category) => category.id === id);
  if (!current) return { ok: false, error: CATEGORY_UNKNOWN_ERROR };
  const problem = validateCategoryInput(input, categories, { editingId: id });
  if (problem) return { ok: false, error: problem };
  const name = input.name.trim();
  const category: Category = {
    ...current,
    name,
    name_key: categoryNameKey(name),
    emoji: input.emoji.trim(),
    color: input.color,
    updated_at: nowIso(),
  };
  return {
    ok: true,
    categories: categories.map((candidate) => (candidate.id === id ? category : candidate)),
    category,
  };
}

// Mesma regra do moveCategories do app: o 1º id fica com position 1...
export function moveDemoCategories(categories: Category[], orderedIds: readonly string[]): Category[] {
  const position = new Map(orderedIds.map((id, index) => [id, index + 1]));
  return sortCategories(
    categories.map((category) =>
      position.has(category.id) ? { ...category, position: position.get(category.id)! } : category,
    ),
  );
}

export function countDemoCategoryItems(space: DemoSpace, categoryId: string): CategoryCounts {
  const counts = { want: 0, done: 0 };
  for (const item of space.items) {
    if (item.category_id === categoryId) counts[item.status] += 1;
  }
  return counts;
}

// C1: só apaga vazia; com itens, devolve os números para a 55b.
export function deleteDemoCategory(
  categories: Category[],
  space: DemoSpace,
  categoryId: string,
):
  | { ok: true; categories: Category[] }
  | ({ ok: false; reason: "not_empty" } & CategoryCounts) {
  const counts = countDemoCategoryItems(space, categoryId);
  if (counts.want + counts.done > 0) return { ok: false, reason: "not_empty", ...counts };
  return { ok: true, categories: categories.filter((category) => category.id !== categoryId) };
}

// Mudar o item de categoria muda só category_id (o type é imutável).
export function setItemCategory(space: DemoSpace, itemId: string, categoryId: string): DemoSpace {
  const stamp = nowIso();
  return {
    ...space,
    items: space.items.map((item) =>
      item.id === itemId && item.category_id !== categoryId
        ? { ...item, category_id: categoryId, updated_at: stamp }
        : item,
    ),
    updatedAt: stamp,
  };
}
