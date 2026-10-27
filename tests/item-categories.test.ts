import { describe, expect, it } from "vitest";

import {
  ALL_CHIP_LABEL,
  TYPE_CHIPS,
  countByStatus,
  parseTypeParam,
  typeFilterSummary,
} from "@/lib/item-categories";
import { TYPE_CHIP_LABELS, TYPE_EMOJI } from "@/lib/labels";
import type { ItemStatus, ItemType } from "@/lib/types";

describe("type chips", () => {
  it("lists Tudo and then one chip per type, Programa first (mockup 21)", () => {
    expect(
      TYPE_CHIPS.map((chip) =>
        chip === "all" ? ALL_CHIP_LABEL : `${TYPE_EMOJI[chip]} ${TYPE_CHIP_LABELS[chip]}`,
      ),
    ).toEqual([
      "Tudo",
      "🧺 Programa",
      "🍝 Restaurante",
      "☕ Comida",
      "🏖️ Passeio",
      "🎬 Filme",
      "🏙️ Cidade",
      "🎟️ Evento",
    ]);
  });
});

describe("parseTypeParam", () => {
  it("reads a single type, highlighting its chip", () => {
    expect(parseTypeParam("restaurant")).toEqual({
      chip: "restaurant",
      types: ["restaurant"],
    });
    expect(parseTypeParam("activity")).toEqual({ chip: "activity", types: ["activity"] });
    expect(parseTypeParam(["event", "movie"])).toEqual({ chip: "event", types: ["event"] });
  });

  it("keeps old group links filtering by the group, with no chip highlighted", () => {
    expect(parseTypeParam("comer")).toEqual({
      chip: null,
      types: ["restaurant", "food_idea"],
    });
    expect(parseTypeParam("passeios")).toEqual({
      chip: null,
      types: ["tourist_spot", "event", "movie"],
    });
    expect(parseTypeParam("viagens")).toEqual({ chip: null, types: ["city"] });
  });

  it("falls back to everything", () => {
    expect(parseTypeParam(undefined)).toEqual({ chip: "all", types: null });
    expect(parseTypeParam("all")).toEqual({ chip: "all", types: null });
    expect(parseTypeParam("nada")).toEqual({ chip: "all", types: null });
    expect(parseTypeParam("toString")).toEqual({ chip: "all", types: null });
  });
});

describe("countByStatus", () => {
  const items: { type: ItemType; status: ItemStatus }[] = [
    { type: "activity", status: "want" },
    { type: "activity", status: "want" },
    { type: "activity", status: "want" },
    { type: "activity", status: "done" },
    { type: "restaurant", status: "want" },
    { type: "movie", status: "done" },
    { type: "movie", status: "done" },
  ];

  it("counts every item when there is no type filter", () => {
    expect(countByStatus(items)).toEqual({ want: 4, done: 3 });
  });

  it("follows the type filter (mockup 21b)", () => {
    const { types } = parseTypeParam("activity");
    const filtered = items.filter((item) => types!.includes(item.type));
    expect(countByStatus(filtered)).toEqual({ want: 3, done: 1 });
  });

  it("follows an old group filter", () => {
    const { types } = parseTypeParam("passeios");
    const filtered = items.filter((item) => types!.includes(item.type));
    expect(countByStatus(filtered)).toEqual({ want: 0, done: 2 });
  });

  it("is zero for an empty list", () => {
    expect(countByStatus([])).toEqual({ want: 0, done: 0 });
  });
});

describe("typeFilterSummary", () => {
  it("matches the spec for Programa", () => {
    expect(typeFilterSummary("activity", 3, "want")).toBe("3 programas em Queremos");
    expect(typeFilterSummary("activity", 1, "want")).toBe("1 programa em Queremos");
    expect(typeFilterSummary("activity", 0, "want")).toBe("0 programas em Queremos");
  });

  it("generalizes to the other types and to Já fizemos", () => {
    expect(typeFilterSummary("restaurant", 2, "done")).toBe("2 restaurantes em Já fizemos");
    expect(typeFilterSummary("tourist_spot", 1, "want")).toBe(
      "1 ponto turístico em Queremos",
    );
    expect(typeFilterSummary("food_idea", 4, "want")).toBe("4 ideias de comida em Queremos");
  });
});
