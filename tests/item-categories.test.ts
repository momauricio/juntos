import { describe, expect, it } from "vitest";

import {
  CATEGORY_LABELS,
  ITEM_CATEGORIES,
  categoryForType,
  parseTypeParam,
  typesForCategory,
} from "@/lib/item-categories";
import { TYPE_LABELS } from "@/lib/labels";
import type { ItemType } from "@/lib/types";

const ALL_TYPES = Object.keys(TYPE_LABELS) as ItemType[];

describe("item categories", () => {
  it("labels the chips like the mockup", () => {
    expect(ITEM_CATEGORIES.map((category) => CATEGORY_LABELS[category])).toEqual([
      "Tudo",
      "Comer",
      "Passeios",
      "Viagens",
    ]);
  });

  it("groups the existing types", () => {
    expect(typesForCategory("all")).toEqual(ALL_TYPES);
    expect(typesForCategory("comer")).toEqual(["restaurant", "food_idea"]);
    expect(typesForCategory("passeios")).toEqual(["tourist_spot", "event", "movie"]);
    expect(typesForCategory("viagens")).toEqual(["city"]);
  });

  it("puts every type in exactly one group", () => {
    const grouped = (["comer", "passeios", "viagens"] as const).flatMap(typesForCategory);
    expect([...grouped].sort()).toEqual([...ALL_TYPES].sort());

    for (const type of ALL_TYPES) {
      expect(typesForCategory(categoryForType(type))).toContain(type);
    }
  });

  it("maps a type to its group", () => {
    expect(categoryForType("restaurant")).toBe("comer");
    expect(categoryForType("food_idea")).toBe("comer");
    expect(categoryForType("movie")).toBe("passeios");
    expect(categoryForType("city")).toBe("viagens");
  });
});

describe("parseTypeParam", () => {
  it("reads a group", () => {
    expect(parseTypeParam("comer")).toEqual({
      category: "comer",
      types: ["restaurant", "food_idea"],
    });
    expect(parseTypeParam(["viagens", "comer"])).toEqual({
      category: "viagens",
      types: ["city"],
    });
  });

  it("keeps an old single type, highlighting its group", () => {
    expect(parseTypeParam("restaurant")).toEqual({
      category: "comer",
      types: ["restaurant"],
    });
    expect(parseTypeParam("event")).toEqual({ category: "passeios", types: ["event"] });
  });

  it("falls back to everything", () => {
    expect(parseTypeParam(undefined)).toEqual({ category: "all", types: null });
    expect(parseTypeParam("all")).toEqual({ category: "all", types: null });
    expect(parseTypeParam("nada")).toEqual({ category: "all", types: null });
  });
});
