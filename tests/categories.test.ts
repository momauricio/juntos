import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import {
  CATEGORY_COLORS,
  CATEGORY_LIMIT,
  CATEGORY_NAME_MAX,
  CUSTOM_CATEGORY_ITEM_TYPE,
  DEFAULT_CATEGORIES,
  HOME_COPY,
  RECENT_LIMIT,
  SCORE_BAND_COLORS,
  STATUS_BADGES,
  categoryErrorCode,
  categoryHref,
  categoryNameKey,
  categorySampleText,
  categoryScoreAverage,
  categoryTiles,
  defaultCategoryForType,
  isSingleEmoji,
  legacyTypeRedirect,
  recentHref,
  recentItems,
  recentTileText,
  scoreBand,
  showsScoreAverage,
  sortByScore,
  sortCategories,
  validateCategoryInput,
} from "@/lib/categories";
import { TYPE_CHIP_LABELS, TYPE_EMOJI } from "@/lib/labels";
import type { ItemType } from "@/lib/types";

const pubs = { id: "c-pubs", name: "Pubs" };
const hospedagem = { id: "c-stay", name: "Hospedagem" };

function existing(n: number) {
  return Array.from({ length: n }, (_, i) => ({ id: `c${i}`, name: `Categoria ${i}` }));
}

describe("constantes", () => {
  it("tem os 8 tokens da paleta P, com nome", () => {
    expect(CATEGORY_COLORS.map((c) => c.token)).toEqual([
      "ph1", "ph2", "ph3", "ph4", "ph5", "ph6", "ph7", "ph8",
    ]);
    expect(CATEGORY_COLORS.find((c) => c.token === "ph8")?.name).toBe("verde-mata");
    expect(CATEGORY_COLORS.find((c) => c.token === "ph5")?.name).toBe("lilás");
  });

  it("limites e tipo da categoria criada pelo casal", () => {
    expect(CATEGORY_LIMIT).toBe(30);
    expect(CATEGORY_NAME_MAX).toBe(24);
    expect(CUSTOM_CATEGORY_ITEM_TYPE).toBe("activity");
  });

  it("DEFAULT_CATEGORIES segue a tabela §3 (nomes dos chips, emojis de hoje)", () => {
    expect(DEFAULT_CATEGORIES.map((c) => [c.position, c.name, c.emoji, c.color, c.item_type])).toEqual([
      [1, "Hospedagem", "🏨", "ph8", "stay"],
      [2, "Restaurante", "🍝", "ph3", "restaurant"],
      [3, "Passeio", "🏖️", "ph2", "tourist_spot"],
      [4, "Programa", "🧺", "ph5", "activity"],
      [5, "Comida", "☕", "ph1", "food_idea"],
      [6, "Cidade", "🏙️", "ph4", "city"],
      [7, "Filme", "🎬", "ph6", "movie"],
      [8, "Evento", "🎟️", "ph7", "event"],
    ]);
    for (const category of DEFAULT_CATEGORIES) {
      const type = category.item_type as ItemType;
      expect(category.name).toBe(TYPE_CHIP_LABELS[type]);
      expect(category.emoji).toBe(TYPE_EMOJI[type]);
    }
  });

  it("DEFAULT_CATEGORIES é igual à semeadura da migration", () => {
    const sql = readFileSync(
      join(process.cwd(), "supabase/migrations/20261031120000_categories.sql"),
      "utf8",
    );
    for (const c of DEFAULT_CATEGORIES) {
      expect(sql).toContain(
        `(p_space_id, ${c.position}, '${c.name}', '${c.emoji}', '${c.color}', '${c.item_type}')`,
      );
    }
  });
});

describe("categoryNameKey", () => {
  it("ignora acento, maiúscula e espaços extras (C2)", () => {
    expect(categoryNameKey("Pubs")).toBe("pubs");
    expect(categoryNameKey("pubs")).toBe("pubs");
    expect(categoryNameKey(" Púbs ")).toBe("pubs");
    expect(categoryNameKey("  Cafés   da   Manhã ")).toBe("cafes da manha");
    expect(categoryNameKey("Ação")).toBe("acao");
  });
});

describe("isSingleEmoji", () => {
  it("aceita um emoji, inclusive com seletor de variação, ZWJ e bandeira", () => {
    for (const emoji of ["🍺", "🏖️", "🏙️", "👩‍❤️‍👨", "🇧🇷", "1️⃣", "☕"]) {
      expect(isSingleEmoji(emoji)).toBe(true);
    }
  });

  it("recusa vazio, dois emojis e texto", () => {
    for (const value of ["", " ", "🍺🍺", "a", "ab", "🍺a"]) {
      expect(isSingleEmoji(value)).toBe(false);
    }
  });
});

describe("validateCategoryInput", () => {
  const ok = { name: "Pubs", emoji: "🍺", color: "ph5" as const };

  it("aceita uma categoria nova válida", () => {
    expect(validateCategoryInput(ok, [hospedagem])).toBeNull();
  });

  it("nome vazio", () => {
    expect(validateCategoryInput({ ...ok, name: "   " }, [])).toBe("Dê um nome pra categoria.");
  });

  it("nome com 25 letras (24 passa)", () => {
    expect(validateCategoryInput({ ...ok, name: "a".repeat(25) }, [])).toBe("Até 24 letras.");
    expect(validateCategoryInput({ ...ok, name: ` ${"a".repeat(24)} ` }, [])).toBeNull();
  });

  it("nome repetido sem diferenciar acento/maiúscula/espaços, citando o nome existente", () => {
    expect(validateCategoryInput({ ...ok, name: " púbs " }, [pubs])).toBe(
      "Vocês já têm uma categoria “Pubs”.",
    );
  });

  it("renomear para o próprio nome mudando só maiúscula é permitido", () => {
    expect(
      validateCategoryInput({ ...ok, name: "PUBS" }, [pubs, hospedagem], { editingId: "c-pubs" }),
    ).toBeNull();
    expect(
      validateCategoryInput({ ...ok, name: "hospedagem" }, [pubs, hospedagem], { editingId: "c-pubs" }),
    ).toBe("Vocês já têm uma categoria “Hospedagem”.");
  });

  it("emoji: um só", () => {
    expect(validateCategoryInput({ ...ok, emoji: "🍺🍻" }, [])).toBe("Escolha um emoji só.");
    expect(validateCategoryInput({ ...ok, emoji: "" }, [])).toBe("Escolha um emoji só.");
  });

  it("limite de 30 ao criar; editar com 30 continua permitido", () => {
    expect(validateCategoryInput(ok, existing(29))).toBeNull();
    expect(validateCategoryInput(ok, existing(30))).toBe(
      "Vocês chegaram ao limite de 30 categorias.",
    );
    expect(validateCategoryInput(ok, existing(30), { editingId: "c0" })).toBeNull();
  });
});

describe("sortCategories", () => {
  it("ordena por position e, no empate, por created_at (C7), sem mudar a lista original", () => {
    const list = [
      { id: "b", position: 2, created_at: "2026-10-31T10:00:00Z" },
      { id: "c", position: 1, created_at: "2026-10-31T12:00:00Z" },
      { id: "a", position: 1, created_at: "2026-10-31T11:00:00Z" },
    ];
    expect(sortCategories(list).map((c) => c.id)).toEqual(["a", "c", "b"]);
    expect(list.map((c) => c.id)).toEqual(["b", "c", "a"]);
  });
});

describe("categoryErrorCode", () => {
  it("mapeia os erros do banco", () => {
    expect(categoryErrorCode({ code: "23503", message: "category_not_empty" })).toBe("not_empty");
    expect(
      categoryErrorCode({
        code: "23503",
        message:
          'update or delete on table "categories" violates foreign key constraint "items_category_id_fkey" on table "items"',
      }),
    ).toBe("not_empty");
    expect(categoryErrorCode({ code: "23514", message: "category_limit" })).toBe("limit");
    expect(
      categoryErrorCode({
        code: "23505",
        message: 'duplicate key value violates unique constraint "categories_space_name_key_unique"',
      }),
    ).toBe("duplicate_name");
    expect(categoryErrorCode({ code: "23514", message: "category_other_space" })).toBe("other_space");
  });

  it("o resto vira unknown", () => {
    expect(categoryErrorCode({ code: "23505", message: 'unique constraint "outra"' })).toBe("unknown");
    expect(categoryErrorCode({ code: "42501", message: "new row violates row-level security policy" })).toBe("unknown");
    expect(categoryErrorCode(null)).toBe("unknown");
    expect(categoryErrorCode(undefined)).toBe("unknown");
  });
});

// ---------------------------------------------------------------------------
// Início por categorias (50/51)

const T0 = "2026-10-31T12:00:00Z";
const cat = (id: string, position: number, item_type: ItemType = "activity", created_at = T0) => ({
  id,
  position,
  item_type,
  created_at,
});
const day = (n: number) => `2026-09-${String(n).padStart(2, "0")}T12:00:00Z`;
const item = (
  id: string,
  category_id: string,
  status: "want" | "done",
  created: number,
  title = id,
) => ({ id, title, status, category_id, created_at: day(created) });

describe("categoryTiles (C5–C7)", () => {
  const categories = [cat("evento", 3, "event"), cat("stay", 1, "stay"), cat("rest", 2, "restaurant")];
  const items = [
    item("a", "rest", "want", 1, "Zaandam"),
    item("b", "rest", "want", 5, "Jardim do Moinho"),
    item("c", "rest", "want", 3, "Casa dos Bifes"),
    item("d", "rest", "done", 9, "Spoleto"),
    item("e", "stay", "want", 2, "Ecos Pitaya"),
    item("f", "sumiu", "want", 7, "De categoria apagada"),
  ];

  it("todas as categorias, por position, mesmo com 0 na aba", () => {
    const tiles = categoryTiles(categories, items, "want");
    expect(tiles.map((t) => [t.category.id, t.count])).toEqual([
      ["stay", 1],
      ["rest", 3],
      ["evento", 0],
    ]);
    expect(categoryTiles(categories, items, "done").map((t) => [t.category.id, t.count])).toEqual([
      ["stay", 0],
      ["rest", 1],
      ["evento", 0],
    ]);
  });

  it("amostra = os 2 mais novos da categoria naquela aba", () => {
    const rest = categoryTiles(categories, items, "want")[1];
    expect(rest.sample).toEqual(["Jardim do Moinho", "Casa dos Bifes"]);
    expect(categoryTiles(categories, items, "want")[2].sample).toEqual([]);
  });

  it("a soma dos quadrados é o número da aba (itens com categoria da lista)", () => {
    const listed = items.filter((i) => i.category_id !== "sumiu");
    const sum = categoryTiles(categories, listed, "want").reduce((n, t) => n + t.count, 0);
    expect(sum).toBe(listed.filter((i) => i.status === "want").length);
  });
});

describe("categorySampleText", () => {
  it("1, 2 e mais de 2 nomes", () => {
    expect(categorySampleText(["Kart"], 1)).toBe("Kart");
    expect(categorySampleText(["Kart", "Pescar"], 2)).toBe("Kart, Pescar");
    expect(categorySampleText(["Kart", "Pescar"], 16)).toBe("Kart, Pescar, +14");
    expect(categorySampleText(["Montt Sierra", "Ecos Pitaya"], 5)).toBe("Montt Sierra, Ecos Pitaya, +3");
  });

  it("com 0: nada ainda", () => {
    expect(categorySampleText([], 0)).toBe("nada ainda");
    expect(HOME_COPY.emptySample).toBe("nada ainda");
  });
});

describe("recentes (C8)", () => {
  const many = Array.from({ length: 14 }, (_, i) => item(`w${i}`, "x", "want", i + 1, `Item ${i + 1}`));
  const items = [...many, item("d1", "x", "done", 30, "Feito")];

  it("os 10 mais novos da aba, de todas as categorias", () => {
    const recent = recentItems(items, "want");
    expect(RECENT_LIMIT).toBe(10);
    expect(recent).toHaveLength(10);
    expect(recent[0].title).toBe("Item 14");
    expect(recent[9].title).toBe("Item 5");
    expect(recentItems(items, "done").map((i) => i.id)).toEqual(["d1"]);
  });

  it("menos de 10 → todos", () => {
    expect(recentItems(many.slice(0, 3), "want")).toHaveLength(3);
  });

  it("quadrado: 3 primeiros nomes, ou Nada ainda", () => {
    expect(recentTileText(recentItems(items, "want"))).toBe("Item 14, Item 13, Item 12");
    expect(recentTileText([])).toBe("Nada ainda");
  });
});

const rating = (score: number | null, food: number | null = null) => ({
  food,
  service: food,
  ambiance: food,
  score,
});

describe("média de nota (C13)", () => {
  it("critério de aceite: 9,0 e 8,0 + 1 sem nota → 8,5 azul, 2 notas", () => {
    const average = categoryScoreAverage([
      { ratings: [rating(null, 9)] },
      { ratings: [rating(8)] },
      { ratings: [] },
    ]);
    expect(average).toEqual({ value: 8.5, count: 2 });
    expect(scoreBand(average!.value)).toBe("blue");
    expect(HOME_COPY.scoreAverage(2)).toBe("média de 2 notas");
  });

  it("0 notas → sem selo", () => {
    expect(categoryScoreAverage([])).toBeNull();
    expect(categoryScoreAverage([{ ratings: [] }, { ratings: null }])).toBeNull();
  });

  it("usa a nota do casal de cada item e arredonda com meio para cima", () => {
    // Casal 8,0 (8 e 8) e 7,5 (7 e 8): média 7,75 → 7,8.
    expect(
      categoryScoreAverage([
        { ratings: [rating(8), rating(8)] },
        { ratings: [rating(7), rating(8)] },
      ]),
    ).toEqual({ value: 7.8, count: 2 });
    // 7,3 e 7,4 → 7,35 → 7,4 (sem erro de float).
    expect(
      categoryScoreAverage([{ ratings: [rating(7.3)] }, { ratings: [rating(7.4)] }])?.value,
    ).toBe(7.4);
  });

  it("1 nota: média de 1 nota", () => {
    expect(categoryScoreAverage([{ ratings: [rating(6)] }])).toEqual({ value: 6, count: 1 });
    expect(HOME_COPY.scoreAverage(1)).toBe("média de 1 nota");
  });

  it("só Restaurante (item_type) em Já fizemos", () => {
    expect(showsScoreAverage({ item_type: "restaurant" }, "done")).toBe(true);
    expect(showsScoreAverage({ item_type: "restaurant" }, "want")).toBe(false);
    expect(showsScoreAverage({ item_type: "food_idea" }, "done")).toBe(false);
  });
});

describe("scoreBand", () => {
  it("faixas do selo .bd", () => {
    expect([10, 9, 8.9, 8, 7.9, 7, 6.9, 1].map(scoreBand)).toEqual([
      "green", "green", "blue", "blue", "orange", "orange", "red", "red",
    ]);
    expect(SCORE_BAND_COLORS).toEqual({
      green: "#4f8a5b",
      blue: "#3f6ea8",
      orange: "#c47a1e",
      red: "#b83b4b",
    });
  });
});

describe("sortByScore (C10)", () => {
  it("nota desc, empate pelo mais recente, sem nota no fim por mais recentes", () => {
    const scores: Record<string, number | null> = { a: 8, b: 9.5, c: 8, d: null, e: null, f: 4.3 };
    const items = [
      item("a", "r", "done", 1),
      item("b", "r", "done", 2),
      item("c", "r", "done", 3),
      item("d", "r", "done", 4),
      item("e", "r", "done", 5),
      item("f", "r", "done", 6),
    ];
    expect(sortByScore(items, (i) => scores[i.id]).map((i) => i.id)).toEqual([
      "b", "c", "a", "f", "e", "d",
    ]);
    expect(items.map((i) => i.id)).toEqual(["a", "b", "c", "d", "e", "f"]);
  });
});

describe("links do início", () => {
  it("categoria e recentes com a aba", () => {
    expect(categoryHref("abc", "done")).toBe("/categorias/abc?status=done");
    expect(categoryHref("abc")).toBe("/categorias/abc");
    expect(recentHref("want")).toBe("/recentes?status=want");
  });

  it("selo de status da busca", () => {
    expect(STATUS_BADGES).toEqual({ want: "💛 Queremos", done: "✓ Já fizemos" });
  });

  it("placeholder e sem resultado", () => {
    expect(HOME_COPY.searchPlaceholder(337)).toBe("Buscar nos 337 lugares e ideias");
    expect(HOME_COPY.searchEmpty("pizza")).toBe("Nada com “pizza”.");
  });
});

describe("legacyTypeRedirect (C15)", () => {
  const categories = [
    cat("stay-1", 1, "stay"),
    cat("rest", 2, "restaurant"),
    cat("pubs", 9, "activity"),
    cat("programa", 4, "activity"),
  ];

  it("sem ?type= não redireciona", () => {
    expect(legacyTypeRedirect(undefined, "done", categories)).toBeNull();
  });

  it("um tipo → categoria padrão (menor position), preservando status", () => {
    expect(legacyTypeRedirect("stay", undefined, categories)).toBe("/categorias/stay-1");
    expect(legacyTypeRedirect("restaurant", "done", categories)).toBe("/categorias/rest?status=done");
    expect(legacyTypeRedirect(["activity", "movie"], "want", categories)).toBe(
      "/categorias/programa?status=want",
    );
    expect(defaultCategoryForType(categories, "activity")?.id).toBe("programa");
  });

  it("grupos antigos, tipo desconhecido ou categoria apagada → início", () => {
    expect(legacyTypeRedirect("comer", "done", categories)).toBe("/?status=done");
    expect(legacyTypeRedirect("passeios", undefined, categories)).toBe("/");
    expect(legacyTypeRedirect("viagens", "want", categories)).toBe("/?status=want");
    expect(legacyTypeRedirect("movie", "done", categories)).toBe("/?status=done");
    expect(legacyTypeRedirect("nada", "xx", categories)).toBe("/");
    expect(legacyTypeRedirect("all", undefined, categories)).toBe("/");
  });
});
