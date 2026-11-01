import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

// Espaços/quebras de linha normalizados: a migration quebra os comandos em linhas.
function read(path: string) {
  return readFileSync(join(process.cwd(), path), "utf8").replace(/\s+/g, " ");
}

const sql = read("supabase/migrations/20261031133000_categories_switch_per_type.sql");
const down = read("supabase/rollback/20261031133000_categories_switch_per_type_down.sql");
const fallback = read("supabase/migrations/20261031130000_categories_switch_fallback.sql");

// Definição da função (do "function public.<nome>(" até o $$; final), sem o
// "create"/"create or replace" da frente.
function fnBody(source: string, name: string) {
  const start = source.indexOf(`function public.${name}(`);
  if (start < 0) return "";
  const end = source.indexOf("$$;", source.indexOf("as $$", start));
  return source.slice(start, end);
}

// O que fica fora dos comentários e dos corpos de função.
function outside(path: string) {
  return readFileSync(join(process.cwd(), path), "utf8")
    .replace(/--.*$/gm, "")
    .replace(/\s+/g, " ")
    .replace(/as \$\$.*?\$\$;/g, "");
}

const sqlOutside = outside("supabase/migrations/20261031133000_categories_switch_per_type.sql");
const downOutside = outside("supabase/rollback/20261031133000_categories_switch_per_type_down.sql");

const REVOKE = "revoke execute on function public.switch_space_and_redeem(text, boolean) from public, anon;";
const GRANT = "grant execute on function public.switch_space_and_redeem(text, boolean) to authenticated;";

describe("categories switch per type migration", () => {
  it("é transacional, vem depois de 20261031130000 e aponta o rollback", () => {
    expect(sql.trim().startsWith("--")).toBe(true);
    expect(sql).toContain(" begin; ");
    expect(sql.trim().endsWith("commit;")).toBe(true);
    expect("20261031133000" > "20261031130000").toBe(true);
    expect(sql).toContain("20261031133000_categories_switch_per_type_down.sql");
  });

  it("só recria switch_space_and_redeem, com a mesma assinatura, e os grants", () => {
    expect(sqlOutside.match(/create or replace function public\.[a-z_]+\(/g)).toEqual([
      "create or replace function public.switch_space_and_redeem(",
    ]);
    expect(sql).toContain(
      "create or replace function public.switch_space_and_redeem(p_code text, p_bring_items boolean) returns uuid language plpgsql security definer set search_path = public as $$",
    );
    expect(sqlOutside).not.toMatch(/\b(alter|drop|insert|update|delete|truncate)\b|create (table|trigger|index|function)/);
    expect(sqlOutside.replace("create or replace function public.switch_space_and_redeem(", "")).not.toContain("create");
    expect(sql).toContain(REVOKE);
    expect(sql).toContain(GRANT);
  });

  it("guarda as padrões de antes da troca e só elas valem como 'primeira padrão'", () => {
    const body = fnBody(sql, "switch_space_and_redeem");
    const lock = body.indexOf("perform 1 from public.spaces where id = v_invite.space_id for update;");
    const prior = body.indexOf(
      "select coalesce(array_agg(c.id), '{}') into v_prior_default_ids from public.categories c where c.space_id = v_invite.space_id and c.created_by is null;",
    );
    const loop = body.indexOf("for v_category in");
    expect(lock).toBeGreaterThan(-1);
    expect(lock).toBeLessThan(prior);
    expect(prior).toBeLessThan(loop);

    const byType = body.indexOf("and c.created_by is null and c.item_type = v_type order by c.position, c.created_at limit 1;");
    const firstPrior = body.indexOf(
      "and c.created_by is null and c.id = any (v_prior_default_ids) order by c.position, c.created_at limit 1;",
    );
    const recreate = body.indexOf("v_new_category_id := public.ensure_default_category(v_invite.space_id, v_type);");
    expect(byType).toBeGreaterThan(loop);
    expect(byType).toBeLessThan(firstPrior);
    expect(firstPrior).toBeLessThan(recreate);
  });

  it("categorias com itens antes das vazias; vazia que não cabe não vai", () => {
    const body = fnBody(sql, "switch_space_and_redeem");
    expect(body).toContain(
      "order by not exists (select 1 from public.items i where i.space_id = v_old_space_id and i.category_id = c.id), c.position, c.created_at",
    );
    expect(body).toContain(
      "if v_new_category_id is null and (select count(*) from public.categories where space_id = v_invite.space_id) < 30 then",
    );
    const mapped = body.indexOf("v_types := v_types || null::text;");
    const skipEmpty = body.indexOf("if not v_has_items then continue; end if;");
    const byType = body.indexOf("for v_type in");
    expect(mapped).toBeGreaterThan(-1);
    expect(mapped).toBeLessThan(skipEmpty);
    expect(skipEmpty).toBeLessThan(byType);
  });

  it("o resto do corpo igual ao de 20261031130000", () => {
    const before = fnBody(fallback, "switch_space_and_redeem");
    const after = fnBody(sql, "switch_space_and_redeem");
    const head = (body: string) => body.slice(0, body.indexOf("declare"));
    const validations = (body: string) =>
      body.slice(body.indexOf("begin if auth.uid() is null"), body.indexOf("if p_bring_items then"));
    const tail = (body: string) => body.slice(body.indexOf("update public.items i"));
    expect(head(after)).toBe(head(before));
    expect(validations(after)).toBe(validations(before));
    expect(tail(after)).toBe(tail(before));
  });
});

describe("categories switch per type rollback", () => {
  it("avisa no topo, roda numa transação e vem antes dos outros rollbacks", () => {
    expect(down.trim().startsWith("-- ATENÇÃO")).toBe(true);
    expect(down).toContain("Só roda com OK do Mauricio");
    expect(down).toContain("Roda ANTES de supabase/rollback/20261031130000_categories_switch_fallback_down.sql");
    expect(down).toContain("supabase/rollback/20261031_categories_down.sql");
    expect(down).toContain(" begin; ");
    expect(down.trim().endsWith("commit;")).toBe(true);
  });

  it("recria o switch_space_and_redeem de 20261031130000 literalmente, com os grants", () => {
    expect(fnBody(down, "switch_space_and_redeem")).not.toBe("");
    expect(fnBody(down, "switch_space_and_redeem")).toBe(fnBody(fallback, "switch_space_and_redeem"));
    expect(down).toContain("create or replace function public.switch_space_and_redeem(p_code text, p_bring_items boolean)");
    expect(down).not.toContain("v_prior_default_ids");
    expect(down).toContain(REVOKE);
    expect(down).toContain(GRANT);
  });

  it("não tem drop nem mexe em tabela ou dado", () => {
    expect(down).not.toMatch(/\bdrop\b/);
    expect(downOutside).not.toMatch(/\b(alter|insert|update|delete|truncate)\b|create (table|trigger|index|function)/);
  });
});
