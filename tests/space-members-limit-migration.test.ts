import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const sql = readFileSync(
  path.join(
    process.cwd(),
    "supabase/migrations/20261021130000_space_members_limit_and_grants.sql",
  ),
  "utf8",
);

describe("space_members limit migration", () => {
  it("adds a before insert trigger on space_members", () => {
    expect(sql).toMatch(
      /create trigger space_members_enforce_limit\s+before insert on public\.space_members\s+for each row execute function public\.enforce_space_member_limit\(\);/,
    );
  });

  it("locks the space row and rejects a third member", () => {
    expect(sql).toMatch(
      /perform 1 from public\.spaces where id = new\.space_id for update;/,
    );
    expect(sql).toContain(">= 2");
    expect(sql).toContain("raise exception 'space_full' using errcode = '23514';");
  });
});

describe("function grants migration", () => {
  it("revokes execute from public and anon", () => {
    expect(sql).toContain(
      "revoke execute on all functions in schema public from public, anon;",
    );
  });

  it.each([
    "public.create_space_with_invite(text, text, timestamptz)",
    "public.redeem_invite(text)",
    "public.regenerate_invite(uuid, text, timestamptz)",
    "public.complete_item_with_rating(uuid, int, int, int, int)",
    "public.is_space_member(uuid)",
    "public.space_member_count(uuid)",
  ])("grants execute on %s to authenticated", (signature) => {
    expect(sql).toContain(
      `grant execute on function ${signature} to authenticated;`,
    );
  });

  it("revokes execute on future functions by default", () => {
    expect(sql).toContain(
      "alter default privileges in schema public revoke execute on functions from public;",
    );
  });

  it("does not grant anything to anon", () => {
    expect(sql).not.toMatch(/^\s*grant\s[^;]*\banon\b/m);
  });
});
