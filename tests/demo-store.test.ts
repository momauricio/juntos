import { describe, expect, it } from "vitest";

import {
  createSpace,
  createUser,
  decodeSpace,
  encodeSpace,
  mergeSpaces,
  addItem,
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
