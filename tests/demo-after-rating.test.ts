import { describe, expect, it } from "vitest";

import {
  categoryFilterAfterRating,
  filterItems,
  ratingSavedMessage,
  statusFilterAfterRating,
  typeFilterAfterRating,
} from "@/lib/demo/after-rating";
import { addItem, sampleState, upsertRating, type DemoSpace } from "@/lib/demo/store";

describe("filters after rating", () => {
  it("moves the status filter from want to done", () => {
    expect(statusFilterAfterRating("want")).toBe("done");
  });

  it("keeps done and all status filters", () => {
    expect(statusFilterAfterRating("done")).toBe("done");
    expect(statusFilterAfterRating("all")).toBe("all");
  });

  it("keeps the type filter when it matches the item, otherwise resets to all", () => {
    expect(typeFilterAfterRating("all", "movie")).toBe("all");
    expect(typeFilterAfterRating("movie", "movie")).toBe("movie");
    expect(typeFilterAfterRating("restaurant", "movie")).toBe("all");
  });
});

describe("categoryFilterAfterRating", () => {
  it("keeps the chip when it matches the item's group, otherwise resets to Tudo", () => {
    expect(categoryFilterAfterRating("all", "movie")).toBe("all");
    expect(categoryFilterAfterRating("passeios", "movie")).toBe("passeios");
    expect(categoryFilterAfterRating("comer", "movie")).toBe("all");
  });
});

describe("ratingSavedMessage", () => {
  it("announces the move to Já fizemos with the title", () => {
    expect(ratingSavedMessage("Pizza da esquina", true)).toBe(
      "Nota salva! Pizza da esquina agora está em Já fizemos ✨",
    );
  });

  it("uses a plain message when editing an already done item", () => {
    expect(ratingSavedMessage("Pizza da esquina", false)).toBe("Nota salva.");
  });
});

describe("rated item stays visible in the list", () => {
  function setup() {
    const { user, space: sample } = sampleState();
    let space: DemoSpace = { ...sample, items: [], ratings: [], trips: [] };
    space = addItem(space, { type: "movie", title: "Filme A", createdBy: user.id });
    space = addItem(space, { type: "city", title: "Lisboa", createdBy: user.id });
    const item = space.items.find((i) => i.title === "Filme A")!;
    return { user, space, item };
  }

  it("shows a want item under Já fizemos after its first rating", () => {
    const { user, space, item } = setup();
    expect(filterItems(space.items, "all", "want").map((i) => i.id)).toContain(item.id);

    const rated = upsertRating(space, { itemId: item.id, ratedBy: user.id, score: 8 });
    const statusFilter = statusFilterAfterRating("want");
    const visible = filterItems(rated.items, typeFilterAfterRating("all", item.type), statusFilter);

    expect(statusFilter).toBe("done");
    expect(visible.find((i) => i.id === item.id)?.status).toBe("done");
    expect(filterItems(rated.items, "all", "want").map((i) => i.id)).not.toContain(item.id);
  });

  it("keeps an already done item visible when its rating is edited", () => {
    const { user, space, item } = setup();
    const rated = upsertRating(space, { itemId: item.id, ratedBy: user.id, score: 6 });
    const edited = upsertRating(rated, { itemId: item.id, ratedBy: user.id, score: 9 });

    const visible = filterItems(
      edited.items,
      typeFilterAfterRating("movie", item.type),
      statusFilterAfterRating("done"),
    );
    expect(visible.map((i) => i.id)).toEqual([item.id]);
  });

  it("resets a mismatched type filter so the rated item is visible", () => {
    const { user, space, item } = setup();
    const rated = upsertRating(space, { itemId: item.id, ratedBy: user.id, score: 7 });
    const visible = filterItems(
      rated.items,
      typeFilterAfterRating("city", item.type),
      statusFilterAfterRating("want"),
    );
    expect(visible.map((i) => i.id)).toContain(item.id);
  });
});
