import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const sql = readFileSync(
  path.join(
    process.cwd(),
    "supabase/migrations/20261023120000_space_lifecycle.sql",
  ),
  "utf8",
);

const AUTHENTICATED_ONLY = [
  "public.create_space_with_invite(text, text)",
  "public.regenerate_invite(uuid, text)",
  "public.rename_space(text)",
  "public.leave_space()",
  "public.switch_space_and_redeem(text, boolean)",
];

describe("space lifecycle migration", () => {
  it("makes spaces.name optional without a default", () => {
    expect(sql).toMatch(
      /alter table public\.spaces\s+alter column name drop not null,\s+alter column name drop default;/,
    );
    expect(sql).not.toContain("'Nós dois'");
  });

  it("drops the old signatures with p_expires_at", () => {
    expect(sql).toContain(
      "drop function public.create_space_with_invite(text, text, timestamptz);",
    );
    expect(sql).toContain(
      "drop function public.regenerate_invite(uuid, text, timestamptz);",
    );
    expect(sql).not.toContain("p_expires_at");
  });

  it.each(AUTHENTICATED_ONLY)(
    "revokes %s from public/anon and grants it to authenticated",
    (signature) => {
      expect(sql).toContain(
        `revoke execute on function ${signature} from public, anon;`,
      );
      expect(sql).toContain(
        `grant execute on function ${signature} to authenticated;`,
      );
    },
  );

  it("grants anon only on invite_preview", () => {
    expect(sql).toContain(
      "revoke execute on function public.invite_preview(text) from public;",
    );
    expect(sql).toContain(
      "grant execute on function public.invite_preview(text) to anon, authenticated;",
    );
    expect(sql.match(/to anon/g)).toHaveLength(1);
  });

  it("keeps invite_preview security definer and stable", () => {
    expect(sql).toMatch(
      /create function public\.invite_preview\(p_code text\)\s+returns jsonb\s+language plpgsql\s+stable\s+security definer\s+set search_path = public/,
    );
  });
});
