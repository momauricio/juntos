import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

// Espaços/quebras de linha normalizados: a migration quebra os comandos em linhas.
function read(path: string) {
  return readFileSync(join(process.cwd(), path), "utf8").replace(/\s+/g, " ");
}

const sql = read("supabase/migrations/20261031130000_categories_switch_fallback.sql");
const down = read("supabase/rollback/20261031130000_categories_switch_fallback_down.sql");
const categories = read("supabase/migrations/20261031120000_categories.sql");

// Definição da função (do "function public.<nome>(" até o $$; final), sem o
// "create"/"create or replace" da frente.
function fnBody(source: string, name: string) {
  const start = source.indexOf(`function public.${name}(`);
  if (start < 0) return "";
  const end = source.indexOf("$$;", source.indexOf("as $$", start));
  return source.slice(start, end);
}

const REPLACED = [
  "categories_normalize",
  "categories_enforce_limit",
  "items_fill_category",
  "switch_space_and_redeem",
];

describe("categories switch fallback migration", () => {
  it("é transacional e vem depois de categories", () => {
    expect(sql.trim().startsWith("--")).toBe(true);
    expect(sql).toContain(" begin; ");
    expect(sql.trim().endsWith("commit;")).toBe(true);
    expect("20261031130000" > "20261031120000").toBe(true);
    expect(sql).toContain("20261031130000_categories_switch_fallback_down.sql");
  });

  it("só recria funções (create or replace), sem mexer em tabela nem trigger", () => {
    for (const name of REPLACED) {
      expect(sql).toContain(`create or replace function public.${name}(`);
    }
    expect(sql).toContain("create function public.ensure_default_category(p_space_id uuid, p_type text) returns uuid");
    expect(sql).not.toMatch(/alter table|create table|drop table|create trigger|drop trigger|drop function/);
  });

  it("inserção do sistema: sem autor e fora do limite de 30, com o lock mantido", () => {
    const normalize = fnBody(sql, "categories_normalize");
    expect(normalize).toContain(
      "if pg_trigger_depth() > 1 or coalesce(current_setting('juntos.system_category', true), '') = 'on' then new.created_by := null;",
    );
    expect(normalize).toContain("new.created_by := auth.uid();");
    for (const kept of [
      "new.name := trim(new.name);",
      "new.name_key := public.category_name_key(new.name);",
      "select max(c.position) + 1 from public.categories c where c.space_id = new.space_id",
      "raise exception 'category_space_immutable' using errcode = '23514'",
      "raise exception 'category_item_type_immutable' using errcode = '23514'",
      "raise exception 'created_by_immutable' using errcode = '23514'",
      "new.updated_at := now();",
    ]) {
      expect(normalize).toContain(kept);
    }

    const limit = fnBody(sql, "categories_enforce_limit");
    const lock = limit.indexOf("perform 1 from public.spaces where id = new.space_id for update;");
    const skip = limit.indexOf("if coalesce(current_setting('juntos.system_category', true), '') = 'on' then return new;");
    expect(lock).toBeGreaterThan(-1);
    expect(lock).toBeLessThan(skip);
    expect(limit).toContain("where space_id = new.space_id) >= 30 then raise exception 'category_limit' using errcode = '23514'");
  });

  it("ensure_default_category: padrão do tipo, senão nome ocupado, senão recria como sistema", () => {
    const ensure = fnBody(sql, "ensure_default_category");
    expect(ensure).toContain("security definer set search_path = public, extensions");
    expect(ensure).toContain("and c.item_type = p_type and c.created_by is null order by c.position, c.created_at limit 1;");
    expect(ensure).toContain("perform 1 from public.spaces where id = p_space_id for update;");
    expect(ensure).toContain("or c.name_key = public.category_name_key(v_name)");
    const on = ensure.indexOf("perform set_config('juntos.system_category', 'on', true);");
    const insert = ensure.indexOf(
      "insert into public.categories (space_id, name, emoji, color, item_type) values (p_space_id, v_name, v_emoji, v_color, p_type)",
    );
    const off = ensure.indexOf("perform set_config('juntos.system_category', 'off', true);");
    expect(on).toBeGreaterThan(-1);
    expect(on).toBeLessThan(insert);
    expect(insert).toBeLessThan(off);
    expect(sql).toContain(
      "revoke execute on function public.ensure_default_category(uuid, text) from public, anon, authenticated;",
    );
    expect(sql).not.toContain("grant execute on function public.ensure_default_category");
  });

  it("ensure_default_category usa os mesmos nome/emoji/cor/tipo da semeadura", () => {
    const seed = [...categories.matchAll(/\(p_space_id, \d, ('[^']+'), ('[^']+'), ('[^']+'), ('[^']+')\)/g)];
    expect(seed).toHaveLength(8);
    const ensure = fnBody(sql, "ensure_default_category");
    for (const [, name, emoji, color, type] of seed) {
      expect(ensure).toContain(`(${type}, ${name}, ${emoji}, ${color})`);
    }
  });

  it("items_fill_category recria a padrão em vez de falhar, mantendo a preferência pela semeada", () => {
    const fill = fnBody(sql, "items_fill_category");
    expect(fill).toContain("order by (c.created_by is not null), c.position, c.created_at limit 1;");
    const ensure = fill.indexOf("new.category_id := public.ensure_default_category(new.space_id, new.type);");
    const required = fill.indexOf("raise exception 'category_required' using errcode = '23502'");
    expect(ensure).toBeGreaterThan(-1);
    expect(ensure).toBeLessThan(required);
  });

  it("switch_space_and_redeem: limite de 30, fallback por tipo, update único e conferência final", () => {
    const body = fnBody(sql, "switch_space_and_redeem");
    expect(body).toContain("perform 1 from public.spaces where id = v_invite.space_id for update;");
    expect(body).toContain("c.name_key = v_category.name_key");
    expect(body).toContain(
      "if v_new_category_id is null and (select count(*) from public.categories where space_id = v_invite.space_id) < 30 then",
    );
    const byType = body.indexOf("and c.created_by is null and c.item_type = v_type order by c.position, c.created_at limit 1;");
    const firstDefault = body.indexOf("and c.created_by is null order by c.position, c.created_at limit 1;");
    const recreate = body.indexOf("v_new_category_id := public.ensure_default_category(v_invite.space_id, v_type);");
    expect(byType).toBeGreaterThan(-1);
    expect(byType).toBeLessThan(firstDefault);
    expect(firstDefault).toBeLessThan(recreate);
    expect(body).toContain(
      "set space_id = v_invite.space_id, category_id = m.new_id from unnest(v_old_ids, v_types, v_new_ids) as m (old_id, item_type, new_id)",
    );
    expect(body).toContain("and (m.item_type is null or m.item_type = i.type);");
    const update = body.indexOf("update public.items i");
    const check = body.indexOf(
      "if exists (select 1 from public.items where space_id = v_old_space_id) then raise exception 'switch_items_left_behind';",
    );
    const del = body.indexOf("delete from public.spaces where id = v_old_space_id;");
    expect(update).toBeLessThan(check);
    expect(check).toBeLessThan(del);
  });

  it("switch_space_and_redeem: o resto do corpo e os grants iguais aos de categories", () => {
    const before = fnBody(categories, "switch_space_and_redeem");
    const after = fnBody(sql, "switch_space_and_redeem");
    const head = (body: string) => body.slice(0, body.indexOf("if p_bring_items then"));
    const tail = (body: string) => body.slice(body.indexOf("delete from public.spaces where id = v_old_space_id;"));
    // só o declare ganhou v_type e v_types
    expect(head(after).replace(" v_type text;", "").replace(" v_types text[] := '{}';", "")).toBe(head(before));
    expect(tail(after)).toBe(tail(before));
    expect(sql).toContain(
      "revoke execute on function public.switch_space_and_redeem(text, boolean) from public, anon;",
    );
    expect(sql).toContain(
      "grant execute on function public.switch_space_and_redeem(text, boolean) to authenticated;",
    );
  });

  it("funções security definer com search_path fixo", () => {
    const definers = sql.match(/security definer set search_path = [a-z, ]+/g) ?? [];
    expect(definers.length).toBe(REPLACED.length + 1);
  });
});

describe("categories switch fallback rollback", () => {
  it("avisa no topo, roda numa transação e vem antes do rollback de categories", () => {
    expect(down.trim().startsWith("-- ATENÇÃO")).toBe(true);
    expect(down).toContain("Só roda com OK do Mauricio");
    expect(down).toContain("rode este arquivo e DEPOIS -- supabase/rollback/20261031_categories_down.sql.");
    expect(down).toContain(" begin; ");
    expect(down.trim().endsWith("commit;")).toBe(true);
  });

  it("volta as 4 funções às versões exatas de categories", () => {
    for (const name of REPLACED) {
      expect(down).toContain(`create or replace function public.${name}(`);
      expect(fnBody(down, name)).toBe(fnBody(categories, name));
    }
    expect(down).not.toContain("juntos.system_category");
    for (const name of REPLACED) {
      expect(fnBody(down, name)).not.toContain("ensure_default_category");
    }
  });

  it("mantém os grants do switch e apaga ensure_default_category depois de items_fill_category", () => {
    expect(down).toContain(
      "revoke execute on function public.switch_space_and_redeem(text, boolean) from public, anon;",
    );
    expect(down).toContain(
      "grant execute on function public.switch_space_and_redeem(text, boolean) to authenticated;",
    );
    expect(down.indexOf("function public.items_fill_category(")).toBeLessThan(
      down.indexOf("drop function if exists public.ensure_default_category(uuid, text);"),
    );
  });

  it("não apaga categoria nem item (fora dos corpos de função)", () => {
    const outside = down.replace(/as \$\$.*?\$\$;/g, "");
    expect(outside).not.toMatch(/delete from|drop table|alter table|truncate/);
  });
});
