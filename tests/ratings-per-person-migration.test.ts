import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const sql = readFileSync(
  join(
    __dirname,
    "..",
    "supabase",
    "migrations",
    "20261022120000_ratings_per_person.sql",
  ),
  "utf8",
);
const normalized = sql.replace(/\s+/g, " ");

describe("ratings per person migration", () => {
  it("swaps the item unique for one rating per person", () => {
    expect(sql).toContain("drop constraint ratings_item_id_key");
    expect(sql).toContain(
      "add constraint ratings_item_person_key unique (item_id, rated_by)",
    );
  });

  it("adds an optional comment up to 280 characters", () => {
    expect(normalized).toContain(
      "add column comment text constraint ratings_comment_length check (char_length(comment) <= 280)",
    );
    expect(sql).toContain("char_length(v_comment) > 280");
    expect(sql).toContain("raise exception 'comment_too_long'");
  });

  it("does not touch the 1–10 checks", () => {
    expect(sql).not.toMatch(/ratings_(food|service|ambiance|score)_check/);
  });

  it("replaces the shared policy with own-row policies", () => {
    expect(sql).toContain("drop policy ratings_all_member on public.ratings");
    for (const [name, command] of [
      ["ratings_select_member", "select"],
      ["ratings_insert_own", "insert"],
      ["ratings_update_own", "update"],
      ["ratings_delete_own", "delete"],
    ]) {
      expect(normalized).toContain(
        `create policy ${name} on public.ratings for ${command}`,
      );
    }
    expect(sql.match(/rated_by = auth\.uid\(\)/g)).toHaveLength(4);
  });

  it("recreates the RPC with p_comment and a per-person upsert", () => {
    expect(normalized).toContain(
      "drop function public.complete_item_with_rating(uuid, int, int, int, int);",
    );
    expect(sql).toContain("p_comment text default null");
    expect(sql).toContain("on conflict (item_id, rated_by) do update");
    expect(sql).not.toMatch(/set rated_by/);
    expect(sql).toContain("if v_item.status = 'want' then");
  });

  it("grants the new signature only to authenticated", () => {
    expect(normalized).toContain(
      "revoke execute on function public.complete_item_with_rating( uuid, int, int, int, int, text ) from public, anon;",
    );
    expect(normalized).toContain(
      "grant execute on function public.complete_item_with_rating( uuid, int, int, int, int, text ) to authenticated;",
    );
  });
});
