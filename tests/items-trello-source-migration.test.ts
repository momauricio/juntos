import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

// Espaços/quebras de linha normalizados: a migration quebra os comandos em linhas.
const sql = readFileSync(
  join(
    process.cwd(),
    "supabase/migrations/20261028120000_items_trello_source.sql",
  ),
  "utf8",
).replace(/\s+/g, " ");

describe("items_trello_source migration", () => {
  it("replaces items_type_check", () => {
    expect(sql).toContain(
      "alter table public.items drop constraint if exists items_type_check;",
    );
    expect(sql).toContain(
      "alter table public.items add constraint items_type_check",
    );
  });

  it("allows stay and keeps the 7 old types", () => {
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
        "stay",
        "tourist_spot",
      ].sort(),
    );
  });

  it("adds the source columns and metadata", () => {
    expect(sql).toContain("add column source text check (source in ('trello'))");
    expect(sql).toContain(
      "add column source_ref text check (char_length(source_ref) between 1 and 64)",
    );
    expect(sql).toContain("add column source_created_at timestamptz");
    expect(sql).toContain(
      "add column metadata jsonb not null default '{}'::jsonb",
    );
    expect(sql).toContain(
      "check ((source is null) = (source_ref is null))",
    );
    expect(sql).toContain("check (jsonb_typeof(metadata) = 'object')");
  });

  it("creates the partial unique index for idempotent imports", () => {
    expect(sql).toContain(
      "create unique index items_source_ref_unique on public.items (space_id, source, source_ref) where source_ref is not null;",
    );
  });

  it("creates import_trello_items as security invoker, only for authenticated", () => {
    expect(sql).toContain(
      "create or replace function public.import_trello_items(p_items jsonb)",
    );
    expect(sql).toContain("security invoker");
    expect(sql).toContain("set search_path = public");
    expect(sql).toContain(
      "on conflict (space_id, source, source_ref) where source_ref is not null do nothing",
    );
    expect(sql).toContain(
      "revoke execute on function public.import_trello_items(jsonb) from public, anon;",
    );
    expect(sql).toContain(
      "grant execute on function public.import_trello_items(jsonb) to authenticated;",
    );
  });

  it("validates the same types in the RPC as in the check", () => {
    expect(sql).toContain(
      "e->>'type' in ('restaurant','food_idea','tourist_spot','movie','city','event','activity','stay')",
    );
  });
});
