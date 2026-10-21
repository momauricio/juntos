import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

const sql = readFileSync(
  join(
    process.cwd(),
    "supabase/migrations/20261021120000_items_authorship.sql",
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
});
