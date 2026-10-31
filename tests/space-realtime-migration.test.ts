import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const read = (file: string) => readFileSync(path.join(process.cwd(), file), "utf8");

const sql = read("supabase/migrations/20261031140000_space_realtime.sql");
const rollback = read("supabase/rollback/20261031140000_space_realtime_down.sql");
// sem os comentários, para o "não contém" não pegar a explicação do topo
const code = sql.replace(/--.*$/gm, "");

describe("space realtime migration", () => {
  it("roda numa transação", () => {
    expect(code.trim().startsWith("begin;")).toBe(true);
    expect(code.trim().endsWith("commit;")).toBe(true);
  });

  it("explica por que não usa a publicação supabase_realtime e não mexe nela", () => {
    expect(sql).toMatch(/NÃO entra na publicação supabase_realtime/);
    expect(code).not.toMatch(/publication/i);
  });

  it.each(["broadcast_space_change", "broadcast_rating_change"])(
    "%s é security definer com search_path fixo e ninguém executa direto",
    (fn) => {
      expect(code).toMatch(
        new RegExp(`create or replace function public\\.${fn}\\(\\)\\s+returns trigger\\s+language plpgsql\\s+security definer\\s+set search_path = public`),
      );
      expect(code).toContain(`revoke execute on function public.${fn}() from public, anon, authenticated;`);
    },
  );

  it("a genérica manda para space:{space_id} (new no insert/update, old no delete) e devolve coalesce(new, old)", () => {
    expect(code).toMatch(
      /realtime\.broadcast_changes\(\s*'space:' \|\| coalesce\(new\.space_id, old\.space_id\)::text,\s*tg_op,\s*tg_op,\s*tg_table_name,\s*tg_table_schema,\s*new,\s*old\s*\)/,
    );
    expect(code).toContain("return coalesce(new, old);");
  });

  it("a de notas acha o espaço pelo item e não manda nada se o item já não existe", () => {
    expect(code).toMatch(/from public\.items i\s+where i\.id = coalesce\(new\.item_id, old\.item_id\);/);
    expect(code).toMatch(/if v_space_id is not null then\s+perform realtime\.broadcast_changes\(\s*'space:' \|\| v_space_id::text,/);
    expect(code).not.toMatch(/raise/);
  });

  it.each([
    ["items_broadcast_changes", "items", "broadcast_space_change"],
    ["categories_broadcast_changes", "categories", "broadcast_space_change"],
    ["ratings_broadcast_changes", "ratings", "broadcast_rating_change"],
  ])("trigger %s: after insert/update/delete em %s, por linha", (trigger, table, fn) => {
    expect(code).toMatch(
      new RegExp(
        `create trigger ${trigger}\\s+after insert or update or delete on public\\.${table}\\s+for each row execute function public\\.${fn}\\(\\);`,
      ),
    );
  });

  it("space_id_from_topic é immutable, valida o uuid inteiro e só authenticated executa", () => {
    expect(code).toMatch(/create or replace function public\.space_id_from_topic\(p_topic text\)\s+returns uuid\s+language sql\s+immutable/);
    expect(code).toContain(
      "p_topic ~ '^space:[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$'",
    );
    expect(code).toContain("revoke execute on function public.space_id_from_topic(text) from public, anon;");
    expect(code).toContain("grant execute on function public.space_id_from_topic(text) to authenticated;");
  });

  it("política só de leitura de broadcast, para membro do espaço do tópico", () => {
    expect(code).toMatch(
      /create policy space_members_receive_broadcast on realtime\.messages\s+for select\s+to authenticated\s+using \(\s*realtime\.messages\.extension = 'broadcast'\s+and public\.is_space_member\(public\.space_id_from_topic\(realtime\.topic\(\)\)\)\s*\);/,
    );
    expect(code).not.toMatch(/for (insert|update|delete|all)/);
  });
});

describe("space realtime rollback", () => {
  it("avisa que só roda com OK do Mauricio", () => {
    expect(rollback).toContain("Só roda com OK do Mauricio");
  });

  it.each([
    "drop trigger if exists items_broadcast_changes on public.items;",
    "drop trigger if exists categories_broadcast_changes on public.categories;",
    "drop trigger if exists ratings_broadcast_changes on public.ratings;",
    "drop policy if exists space_members_receive_broadcast on realtime.messages;",
    "drop function if exists public.broadcast_space_change();",
    "drop function if exists public.broadcast_rating_change();",
    "drop function if exists public.space_id_from_topic(text);",
  ])("%s", (statement) => {
    expect(rollback).toContain(statement);
  });

  it("tira os triggers antes das funções e não apaga dado", () => {
    expect(rollback.indexOf("drop trigger")).toBeLessThan(rollback.indexOf("drop function"));
    expect(rollback).not.toMatch(/drop table|delete from|truncate/i);
  });
});
