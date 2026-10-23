import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

const sql = readFileSync(
  join(
    process.cwd(),
    "supabase/migrations/20261021123000_items_authorship.sql",
  ),
  "utf8",
);

describe("items_authorship migration", () => {
  it("adds and backfills items.updated_by", () => {
    expect(sql).toContain(
      "alter table public.items add column updated_by uuid references auth.users (id);",
    );
    expect(sql).toContain(
      "update public.items set updated_by = created_by where updated_by is null;",
    );
  });

  it("sets updated_by on insert via force_item_created_by", () => {
    expect(sql).toMatch(
      /create or replace function public\.force_item_created_by\(\)[\s\S]*?new\.created_by := v_uid;\s*new\.updated_by := v_uid;/,
    );
  });

  it("forces authorship on item updates", () => {
    expect(sql).toContain("raise exception 'created_by_immutable'");
    expect(sql).toContain("new.updated_by := auth.uid();");
    expect(sql).toContain("new.updated_at := now();");
    expect(sql).toContain("before update on public.items");
  });

  it("keeps authorship on no-op item updates", () => {
    expect(sql).toMatch(
      /create function public\.enforce_item_authorship\(\)[\s\S]*?v_row public\.items%rowtype;[\s\S]*?v_row := new;\s*v_row\.updated_by := old\.updated_by;\s*v_row\.updated_at := old\.updated_at;\s*if v_row is not distinct from old then\s*new\.updated_by := old\.updated_by;\s*new\.updated_at := old\.updated_at;\s*return new;\s*end if;\s*new\.updated_by := auth\.uid\(\);\s*new\.updated_at := now\(\);/,
    );
  });

  it("applies the same treatment to spaces", () => {
    expect(sql).toContain(
      "alter table public.spaces add column updated_by uuid references auth.users (id)",
    );
    expect(sql).toContain(
      "update public.spaces set updated_by = created_by where updated_by is null;",
    );
    expect(sql).toMatch(
      /create function public\.enforce_space_authorship\(\)[\s\S]*?created_by_immutable[\s\S]*?new\.updated_by := auth\.uid\(\);/,
    );
    expect(sql).toContain("before update on public.spaces");
  });

  it("adds, backfills and forces spaces.updated_at", () => {
    const addColumn =
      "alter table public.spaces add column updated_at timestamptz not null default now();";
    const backfill = "update public.spaces set updated_at = created_at;";
    const trigger = "create trigger spaces_enforce_authorship";
    expect(sql).toContain(addColumn);
    expect(sql).toContain(backfill);
    expect(sql.indexOf(addColumn)).toBeLessThan(sql.indexOf(backfill));
    expect(sql.indexOf(backfill)).toBeLessThan(sql.indexOf(trigger));
    expect(
      sql.indexOf(
        "update public.spaces set updated_by = created_by where updated_by is null;",
      ),
    ).toBeLessThan(sql.indexOf(trigger));
    expect(sql).toMatch(
      /create function public\.enforce_space_authorship\(\)[\s\S]*?new\.updated_by := auth\.uid\(\);\s*new\.updated_at := now\(\);/,
    );
  });
});
