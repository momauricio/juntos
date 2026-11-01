import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

// Espaços/quebras de linha normalizados: a migration quebra os comandos em linhas.
function read(path: string) {
  return readFileSync(join(process.cwd(), path), "utf8");
}

const migration = read("supabase/migrations/20261031150000_items_city.sql");
const sql = migration.replace(/\s+/g, " ");
const rollback = read("supabase/rollback/20261031150000_items_city_down.sql");
const rollbackSql = rollback.replace(/\s+/g, " ");

describe("items_city migration", () => {
  it("adds items.city as nullable text, without default", () => {
    expect(sql).toContain("alter table public.items add column city text null;");
    expect(sql).not.toMatch(/city text[^;]*default/);
    expect(sql).not.toMatch(/city text[^;]*not null/);
  });

  it("checks trim and 1 to 60 characters", () => {
    expect(sql).toContain(
      "add constraint items_city_check check (city is null or (city = btrim(city) and char_length(city) between 1 and 60));",
    );
  });

  it("does not touch existing data (no backfill)", () => {
    expect(sql).not.toMatch(/\bupdate\b/i);
    expect(sql).not.toMatch(/\binsert\b/i);
    expect(sql).not.toMatch(/\bdelete\b/i);
    expect(sql).toMatch(/^.*begin; .* commit; $/);
  });
});

describe("items_city rollback", () => {
  it("drops the check and the column", () => {
    expect(rollbackSql).toContain("alter table public.items drop constraint if exists items_city_check;");
    expect(rollbackSql).toContain("alter table public.items drop column if exists city;");
    expect(rollbackSql).toContain("begin;");
    expect(rollbackSql).toContain("commit;");
  });

  it("warns at the top that the cities are lost", () => {
    const top = rollback.split("\n").slice(0, 3).join("\n");
    expect(top).toContain("ATENÇÃO");
    expect(top).toContain("PERDE TODAS AS CIDADES");
  });
});
