import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

const sql = readFileSync(
  join(
    process.cwd(),
    "supabase/migrations/20261027120000_add_activity_item_type.sql",
  ),
  "utf8",
);

describe("add_activity_item_type migration", () => {
  it("replaces items_type_check", () => {
    expect(sql).toContain(
      "alter table public.items drop constraint if exists items_type_check;",
    );
    expect(sql).toContain(
      "alter table public.items add constraint items_type_check",
    );
  });

  it("allows activity and keeps the 6 old types", () => {
    const list = sql.match(/check \(type in \(([^)]*)\)\)/)?.[1] ?? "";
    const types = list.split(",").map((value) => value.trim().replace(/'/g, ""));
    expect([...types].sort()).toEqual(
      [
        "activity",
        "city",
        "event",
        "food_idea",
        "movie",
        "restaurant",
        "tourist_spot",
      ].sort(),
    );
  });
});
