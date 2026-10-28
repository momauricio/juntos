import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const migrationsDir = join(__dirname, "..", "supabase", "migrations");
const readMigration = (name: string) =>
  readFileSync(join(migrationsDir, name), "utf8");

const sql = readMigration("20261028130000_ratings_decimal.sql");
const normalized = sql.replace(/\s+/g, " ");
const initSql = readMigration("20260728015342_init.sql");

const COLUMNS = ["food", "service", "ambiance", "score"];

function functionBody(source: string, name: string): string {
  const match = source.match(
    new RegExp(
      `create (?:or replace )?function public\\.${name}\\([^)]*\\)[\\s\\S]*?\\$\\$([\\s\\S]*?)\\$\\$;`,
    ),
  );
  if (!match) throw new Error(`${name} not found`);
  return match[1];
}

describe("ratings decimal migration", () => {
  it.each(COLUMNS)("turns %s into numeric(3,1) keeping the values", (column) => {
    expect(sql).toContain(
      `alter column ${column} type numeric(3,1) using ${column}::numeric(3,1)`,
    );
  });

  it.each(COLUMNS)(
    "recreates ratings_%s_check with 1–10 and one decimal",
    (column) => {
      expect(sql).toContain(`drop constraint ratings_${column}_check`);
      expect(normalized).toContain(
        `add constraint ratings_${column}_check check (${column} between 1 and 10 and ${column} = round(${column}, 1))`,
      );
    },
  );

  it("drops the constraints before changing the type", () => {
    expect(sql.indexOf("drop constraint ratings_food_check")).toBeLessThan(
      sql.indexOf("alter column food type"),
    );
    expect(sql.indexOf("alter column food type")).toBeLessThan(
      sql.indexOf("add constraint ratings_food_check"),
    );
  });

  it("keeps ratings_shape untouched", () => {
    expect(sql).not.toMatch(/constraint ratings_shape/);
  });

  it("recreates the shape trigger function with the same body to drop cached plans", () => {
    expect(sql).toContain(
      "create or replace function public.enforce_rating_identity_and_shape()",
    );
    expect(functionBody(sql, "enforce_rating_identity_and_shape")).toBe(
      functionBody(initSql, "enforce_rating_identity_and_shape"),
    );
    expect(sql).not.toMatch(/drop trigger/);
  });

  it("swaps the integer RPC for a numeric one with the same parameter names", () => {
    expect(normalized).toContain(
      "drop function public.complete_item_with_rating(uuid, int, int, int, int, text);",
    );
    for (const name of ["p_food", "p_service", "p_ambiance", "p_score"]) {
      expect(sql).toContain(`${name} numeric default null`);
    }
    expect(sql).toContain("p_item_id uuid");
    expect(sql).toContain("p_comment text default null");
    expect(sql).not.toMatch(/p_\w+ int\b/);
  });

  it("validates range and one decimal in the RPC with the same errors", () => {
    for (const name of ["p_food", "p_service", "p_ambiance", "p_score"]) {
      expect(sql).toContain(`${name} not between 1 and 10`);
      expect(sql).toContain(`round(${name}, 1) <> ${name}`);
    }
    expect(sql).toContain("raise exception 'restaurant_rating_shape' using errcode = '23514'");
    expect(sql).toContain("raise exception 'standard_rating_shape' using errcode = '23514'");
    expect(sql).toContain("raise exception 'comment_too_long'");
    expect(sql).toContain("on conflict (item_id, rated_by) do update");
    expect(sql).toContain("if v_item.status = 'want' then");
  });

  it("grants the numeric signature only to authenticated", () => {
    expect(normalized).toContain(
      "revoke execute on function public.complete_item_with_rating( uuid, numeric, numeric, numeric, numeric, text ) from public, anon;",
    );
    expect(normalized).toContain(
      "grant execute on function public.complete_item_with_rating( uuid, numeric, numeric, numeric, numeric, text ) to authenticated;",
    );
  });
});
