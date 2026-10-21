import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const migrationsDir = join(__dirname, "..", "supabase", "migrations");
const readMigration = (name: string) =>
  readFileSync(join(migrationsDir, name), "utf8");

const scaleSql = readMigration("20261020120000_ratings_scale_1_10.sql");
const originalRpcSql = readMigration("20260728030000_complete_item_rpc.sql");

function rpcParameters(sql: string): string {
  const match = sql.match(
    /create (?:or replace )?function public\.complete_item_with_rating\(([^)]*)\)/,
  );
  if (!match) throw new Error("complete_item_with_rating not found");
  return match[1].replace(/\s+/g, " ").trim();
}

describe("ratings 1–10 migration", () => {
  it.each(["food", "service", "ambiance", "score"])(
    "drops and re-adds ratings_%s_check with 1–10",
    (column) => {
      expect(scaleSql).toContain(
        `drop constraint if exists ratings_${column}_check`,
      );
      expect(scaleSql).toContain(
        `add constraint ratings_${column}_check check (${column} between 1 and 10)`,
      );
    },
  );

  it("replaces complete_item_with_rating with 1–10 bounds", () => {
    expect(scaleSql).toContain(
      "create or replace function public.complete_item_with_rating(",
    );
    expect(scaleSql).not.toMatch(/between 1 and 5\b/);
    expect(scaleSql.match(/between 1 and 10\b/g)).toHaveLength(8);
  });

  it("keeps the original RPC signature", () => {
    expect(rpcParameters(scaleSql)).toBe(rpcParameters(originalRpcSql));
  });
});
