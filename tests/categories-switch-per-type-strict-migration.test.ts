import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

// Espaços/quebras de linha normalizados: a migration quebra os comandos em linhas.
function read(path: string) {
  return readFileSync(join(process.cwd(), path), "utf8").replace(/\s+/g, " ");
}

const MIGRATION = "supabase/migrations/20261031134500_categories_switch_per_type_strict.sql";
const ROLLBACK = "supabase/rollback/20261031134500_categories_switch_per_type_strict_down.sql";

const sql = read(MIGRATION);
const down = read(ROLLBACK);
const perType = read("supabase/migrations/20261031133000_categories_switch_per_type.sql");

// Definição da função (do "function public.<nome>(" até o $$; final), sem o
// "create"/"create or replace" da frente.
function fnBody(source: string, name: string) {
  const start = source.indexOf(`function public.${name}(`);
  if (start < 0) return "";
  const end = source.indexOf("$$;", source.indexOf("as $$", start));
  return source.slice(start, end);
}

// Sem os comentários.
function code(path: string) {
  return readFileSync(join(process.cwd(), path), "utf8")
    .replace(/--.*$/gm, "")
    .replace(/\s+/g, " ");
}

// O que fica fora dos comentários e dos corpos de função.
function outside(path: string) {
  return code(path).replace(/as \$\$.*?\$\$;/g, "");
}

const sqlCode = code(MIGRATION);
const sqlOutside = outside(MIGRATION);
const downOutside = outside(ROLLBACK);

const REVOKE = "revoke execute on function public.switch_space_and_redeem(text, boolean) from public, anon;";
const GRANT = "grant execute on function public.switch_space_and_redeem(text, boolean) to authenticated;";

describe("categories switch per type strict migration", () => {
  it("é transacional, vem depois de 20261031133000 e aponta o rollback", () => {
    expect(sql.trim().startsWith("--")).toBe(true);
    expect(sql).toContain(" begin; ");
    expect(sql.trim().endsWith("commit;")).toBe(true);
    expect("20261031134500" > "20261031133000").toBe(true);
    expect(sql).toContain("20261031134500_categories_switch_per_type_strict_down.sql");
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

  it("sem v_prior_default_ids nem 'primeira padrão': sem a padrão do tipo, recria a do tipo", () => {
    const body = fnBody(sqlCode, "switch_space_and_redeem");
    expect(sqlCode).not.toContain("v_prior_default_ids");
    expect(sqlCode).not.toContain("any (");
    // a única busca de padrão (created_by is null) é a do tipo
    expect(body.match(/c\.created_by is null/g)).toEqual(["c.created_by is null"]);

    const byType = body.indexOf(
      "if v_new_category_id is null then v_new_category_id := public.ensure_default_category(v_invite.space_id, v_type); end if;",
    );
    const lookup = body.indexOf(
      "select c.id into v_new_category_id from public.categories c where c.space_id = v_invite.space_id and c.created_by is null and c.item_type = v_type order by c.position, c.created_at limit 1;",
    );
    expect(lookup).toBeGreaterThan(body.indexOf("for v_type in"));
    expect(lookup).toBeLessThan(byType);
  });

  it("o resto do corpo igual ao de 20261031133000 (só sai a regra 'primeira padrão')", () => {
    const before = fnBody(code("supabase/migrations/20261031133000_categories_switch_per_type.sql"), "switch_space_and_redeem");
    const after = fnBody(sqlCode, "switch_space_and_redeem");
    const withoutPrior = before
      .replace(" v_prior_default_ids uuid[];", "")
      .replace(
        " select coalesce(array_agg(c.id), '{}') into v_prior_default_ids from public.categories c where c.space_id = v_invite.space_id and c.created_by is null;",
        "",
      )
      .replace(
        " if v_new_category_id is null then select c.id into v_new_category_id from public.categories c where c.space_id = v_invite.space_id and c.created_by is null and c.id = any (v_prior_default_ids) order by c.position, c.created_at limit 1; end if;",
        "",
      );
    expect(withoutPrior).not.toBe(before);
    expect(after).toBe(withoutPrior);
  });
});

describe("categories switch per type strict rollback", () => {
  it("avisa no topo, roda numa transação e vem antes dos outros rollbacks", () => {
    expect(down.trim().startsWith("-- ATENÇÃO")).toBe(true);
    expect(down).toContain("Só roda com OK do Mauricio");
    expect(down).toContain("Roda ANTES de supabase/rollback/20261031133000_categories_switch_per_type_down.sql");
    expect(down).toContain("supabase/rollback/20261031130000_categories_switch_fallback_down.sql");
    expect(down).toContain("supabase/rollback/20261031_categories_down.sql");
    expect(down).toContain("20261031140000");
    expect(down).toContain(" begin; ");
    expect(down.trim().endsWith("commit;")).toBe(true);
  });

  it("recria o switch_space_and_redeem de 20261031133000 literalmente, com os grants", () => {
    expect(fnBody(down, "switch_space_and_redeem")).not.toBe("");
    expect(fnBody(down, "switch_space_and_redeem")).toBe(fnBody(perType, "switch_space_and_redeem"));
    expect(down).toContain("create or replace function public.switch_space_and_redeem(p_code text, p_bring_items boolean)");
    expect(down).toContain(REVOKE);
    expect(down).toContain(GRANT);
  });

  it("não tem drop nem mexe em tabela ou dado", () => {
    expect(down).not.toMatch(/\bdrop\b/);
    expect(downOutside.match(/create or replace function public\.[a-z_]+\(/g)).toEqual([
      "create or replace function public.switch_space_and_redeem(",
    ]);
    expect(downOutside).not.toMatch(/\b(alter|insert|update|delete|truncate)\b|create (table|trigger|index|function)/);
  });
});
