import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

// Espaços/quebras de linha normalizados: a migration quebra os comandos em linhas.
function read(path: string) {
  return readFileSync(join(process.cwd(), path), "utf8").replace(/\s+/g, " ");
}

const sql = read("supabase/migrations/20261031120000_categories.sql");
const down = read("supabase/rollback/20261031_categories_down.sql");
const lifecycle = read("supabase/migrations/20261023120000_space_lifecycle.sql");

// Corpo de switch_space_and_redeem (do create até o $$; final).
function switchBody(source: string) {
  const start = source.indexOf(
    "function public.switch_space_and_redeem(p_code text, p_bring_items boolean)",
  );
  const end = source.indexOf("$$;", source.indexOf("as $$", start));
  return source.slice(start, end);
}

const NEW_FUNCTIONS = [
  "category_name_key(text)",
  "categories_normalize()",
  "categories_enforce_limit()",
  "categories_prevent_delete_non_empty()",
  "seed_default_categories(uuid)",
  "spaces_seed_categories()",
  "items_fill_category()",
  "items_category_same_space()",
];

describe("categories migration", () => {
  it("é transacional", () => {
    expect(sql.trim().startsWith("--")).toBe(true);
    expect(sql).toContain(" begin; ");
    expect(sql.trim().endsWith("commit;")).toBe(true);
  });

  it("faz o backup dos itens antes de tudo, sem acesso do app", () => {
    expect(sql).toContain("create schema if not exists backup;");
    expect(sql).toContain("revoke all on schema backup from public, anon, authenticated;");
    expect(sql).toContain(
      "create table backup.items_before_categories_20261031 as select id, space_id, type, status, created_at, updated_at, updated_by from public.items;",
    );
    expect(sql).toContain(
      "revoke all on table backup.items_before_categories_20261031 from public, anon, authenticated;",
    );
    expect(sql.indexOf("backup.items_before_categories_20261031")).toBeLessThan(
      sql.indexOf("create table public.categories"),
    );
  });

  it("instala unaccent em extensions e usa search_path com extensions", () => {
    expect(sql).toContain("create schema if not exists extensions;");
    expect(sql).toContain("create extension if not exists unaccent with schema extensions;");
    expect(sql).toContain(
      "lower(regexp_replace(unaccent(trim(p_name)), '\\s+', ' ', 'g'))",
    );
    expect(sql).not.toContain("extensions.unaccent(");
    expect(sql).toMatch(
      /create function public\.category_name_key\(p_name text\) returns text language sql stable set search_path = public, extensions/,
    );
  });

  it("cria categories com as colunas e checks da spec", () => {
    expect(sql).toContain("space_id uuid not null references public.spaces (id) on delete cascade");
    expect(sql).toContain("name text not null check (char_length(name) between 1 and 24)");
    expect(sql).toContain("name_key text not null");
    expect(sql).toContain("emoji text not null check (char_length(emoji) between 1 and 16)");
    expect(sql).toContain(
      "color text not null check (color in ('ph1','ph2','ph3','ph4','ph5','ph6','ph7','ph8'))",
    );
    expect(sql).toContain("position int not null");
    expect(sql).toContain(
      "item_type text not null default 'activity' check (item_type in ('restaurant','food_idea','tourist_spot','movie','city','event','activity','stay'))",
    );
    expect(sql).toContain("created_by uuid null references auth.users (id) on delete set null");
    expect(sql).toContain("constraint categories_space_name_key_unique unique (space_id, name_key)");
    expect(sql).toContain(
      "create index categories_space_position_idx on public.categories (space_id, position);",
    );
  });

  it("normaliza nome, completa position/created_by e trava space_id, item_type e created_by", () => {
    expect(sql).toContain("before insert or update on public.categories");
    expect(sql).toContain("new.name := trim(new.name);");
    expect(sql).toContain("new.name_key := public.category_name_key(new.name);");
    expect(sql).toContain("select max(c.position) + 1 from public.categories c where c.space_id = new.space_id");
    expect(sql).toContain("if pg_trigger_depth() > 1 then new.created_by := null;");
    expect(sql).toContain("new.created_by := auth.uid();");
    expect(sql).toContain("raise exception 'category_space_immutable' using errcode = '23514'");
    expect(sql).toContain("raise exception 'category_item_type_immutable' using errcode = '23514'");
    expect(sql).toContain("raise exception 'created_by_immutable' using errcode = '23514'");
  });

  it("limita a 30 por espaço com lock no espaço", () => {
    expect(sql).toContain("before insert on public.categories");
    expect(sql).toContain("perform 1 from public.spaces where id = new.space_id for update;");
    expect(sql).toContain("where space_id = new.space_id) >= 30 then raise exception 'category_limit' using errcode = '23514'");
  });

  it("só apaga categoria vazia, sem travar o cascade de spaces", () => {
    expect(sql).toContain("before delete on public.categories");
    expect(sql).toContain(
      "if exists (select 1 from public.items where category_id = old.id) then raise exception 'category_not_empty' using errcode = '23503'",
    );
    expect(sql).toContain(
      "if not exists (select 1 from public.spaces where id = old.space_id) then return old;",
    );
  });

  it("liga RLS com as 4 policies de membro e grants só para authenticated", () => {
    expect(sql).toContain("alter table public.categories enable row level security;");
    expect(sql).toContain(
      "create policy categories_select_member on public.categories for select using (public.is_space_member(space_id));",
    );
    expect(sql).toContain(
      "create policy categories_insert_member on public.categories for insert with check (public.is_space_member(space_id));",
    );
    expect(sql).toContain(
      "create policy categories_update_member on public.categories for update using (public.is_space_member(space_id)) with check (public.is_space_member(space_id));",
    );
    expect(sql).toContain(
      "create policy categories_delete_member on public.categories for delete using (public.is_space_member(space_id));",
    );
    expect(sql).toContain("revoke all on public.categories from anon;");
    expect(sql).toContain(
      "grant select, insert, update, delete on public.categories to authenticated;",
    );
  });

  it("semeia as 8 categorias padrão em espaços novos e existentes", () => {
    const seed = sql.match(
      /insert into public\.categories \(space_id, position, name, emoji, color, item_type\) values (.*?) on conflict \(space_id, name_key\) do nothing;/,
    )?.[1];
    expect(seed).toBeDefined();
    const rows = seed!.split("),").map((row) => row.trim());
    expect(rows).toHaveLength(8);
    expect(seed).toContain("(p_space_id, 1, 'Hospedagem', '🏨', 'ph8', 'stay')");
    expect(seed).toContain("(p_space_id, 8, 'Evento', '🎟️', 'ph7', 'event')");
    expect(sql).toContain("create trigger spaces_seed_categories after insert on public.spaces");
    expect(sql).toContain("select public.seed_default_categories(s.id) from public.spaces s;");
  });

  it("items.category_id sem restrict/cascade e backfill sem carimbar autoria", () => {
    expect(sql).toContain(
      "alter table public.items add column category_id uuid references public.categories (id);",
    );
    expect(sql).not.toMatch(/category_id uuid references public\.categories \(id\) on delete/);
    expect(sql).not.toContain("on delete restrict");

    const disable = sql.indexOf("alter table public.items disable trigger items_enforce_authorship;");
    const backfill = sql.indexOf("update public.items i set category_id = c.id");
    const enable = sql.indexOf("alter table public.items enable trigger items_enforce_authorship;");
    expect(disable).toBeGreaterThan(-1);
    expect(disable).toBeLessThan(backfill);
    expect(backfill).toBeLessThan(enable);
    expect(sql).toContain(
      "where c.space_id = i.space_id and c.item_type = i.type and i.category_id is null;",
    );
  });

  it("aborta se sobrar item sem categoria e só então põe not null + índice", () => {
    const check = sql.indexOf("select count(*) into v_missing from public.items where category_id is null;");
    const notNull = sql.indexOf("alter table public.items alter column category_id set not null;");
    expect(check).toBeGreaterThan(-1);
    expect(sql).toContain("raise exception 'categories_backfill: % itens sem categoria', v_missing;");
    expect(check).toBeLessThan(notNull);
    expect(sql).toContain("create index items_category_id_idx on public.items (category_id);");
  });

  it("preenche a categoria pelo tipo, preferindo a semeada", () => {
    expect(sql).toContain("create trigger items_fill_category before insert on public.items");
    expect(sql).toContain(
      "order by (c.created_by is not null), c.position, c.created_at limit 1;",
    );
    expect(sql).toContain("raise exception 'category_required' using errcode = '23502'");
  });

  it("exige categoria do mesmo espaço, sem exigir o mesmo tipo", () => {
    expect(sql).toContain(
      "create trigger items_category_same_space before insert or update of category_id, space_id on public.items",
    );
    expect(sql).toContain("if new.category_id is not null and not exists");
    expect(sql).toContain("raise exception 'category_other_space' using errcode = '23514'");
    expect(sql).not.toMatch(/c\.item_type = new\.type and c\.id = new\.category_id/);
  });

  it("switch_space_and_redeem leva as categorias e mantém os grants", () => {
    const body = switchBody(sql);
    expect(sql).toContain(
      "create or replace function public.switch_space_and_redeem(p_code text, p_bring_items boolean)",
    );
    expect(body).toContain("where space_id = v_old_space_id order by position, created_at");
    expect(body).toContain("c.name_key = v_category.name_key");
    expect(body).toContain(
      "insert into public.categories (space_id, name, emoji, color, item_type) values (v_invite.space_id, v_category.name, v_category.emoji, v_category.color, v_category.item_type)",
    );
    expect(body).toContain(
      "set space_id = v_invite.space_id, category_id = m.new_id from unnest(v_old_ids, v_new_ids) as m (old_id, new_id)",
    );
    expect(body.indexOf("update public.items i")).toBeLessThan(
      body.indexOf("delete from public.spaces where id = v_old_space_id;"),
    );
    expect(sql).toContain(
      "revoke execute on function public.switch_space_and_redeem(text, boolean) from public, anon;",
    );
    expect(sql).toContain(
      "grant execute on function public.switch_space_and_redeem(text, boolean) to authenticated;",
    );
  });

  it("adiciona profiles.item_view (grid/compact)", () => {
    expect(sql).toContain(
      "alter table public.profiles add column item_view text not null default 'grid' check (item_view in ('grid','compact'));",
    );
  });

  it("tira EXECUTE de todas as funções novas internas", () => {
    for (const fn of NEW_FUNCTIONS) {
      expect(sql).toContain(`create function public.${fn.replace("(text)", "(p_name text)").replace("(uuid)", "(p_space_id uuid)")}`);
      expect(sql).toContain(
        `revoke execute on function public.${fn} from public, anon, authenticated;`,
      );
      expect(sql).not.toContain(`grant execute on function public.${fn}`);
    }
  });

  it("funções security definer com search_path fixo", () => {
    const definers = sql.match(/security definer set search_path = [a-z, ]+/g) ?? [];
    expect(definers.length).toBe(NEW_FUNCTIONS.length); // 7 novas + switch
  });
});

describe("categories rollback", () => {
  it("avisa no topo o que se perde e roda numa transação", () => {
    expect(down.trim().startsWith("-- ATENÇÃO")).toBe(true);
    expect(down).toContain("Só roda com OK do Mauricio");
    expect(down).toContain("categorias criadas pelo casal");
    expect(down).toContain(" begin; ");
    expect(down.trim().endsWith("commit;")).toBe(true);
  });

  it("desfaz triggers, coluna, tabela, item_view e todas as funções novas", () => {
    expect(down).toContain("drop trigger if exists items_fill_category on public.items;");
    expect(down).toContain("drop trigger if exists items_category_same_space on public.items;");
    expect(down).toContain("alter table public.items drop column if exists category_id;");
    expect(down).toContain("drop trigger if exists spaces_seed_categories on public.spaces;");
    expect(down).toContain("drop table if exists public.categories;");
    expect(down).toContain("alter table public.profiles drop column if exists item_view;");
    for (const fn of NEW_FUNCTIONS) {
      expect(down).toContain(`drop function if exists public.${fn};`);
    }
  });

  it("não derruba unaccent nem o schema backup", () => {
    expect(down).not.toMatch(/drop extension/);
    expect(down).not.toMatch(/drop schema/);
    expect(down).not.toMatch(/drop table if exists backup\./);
  });

  it("recria switch_space_and_redeem com o corpo antigo exato e os grants", () => {
    expect(switchBody(down)).toBe(switchBody(lifecycle));
    expect(switchBody(down)).not.toContain("categories");
    expect(down).toContain(
      "revoke execute on function public.switch_space_and_redeem(text, boolean) from public, anon;",
    );
    expect(down).toContain(
      "grant execute on function public.switch_space_and_redeem(text, boolean) to authenticated;",
    );
  });

  it("confere tipos e contagem contra o backup", () => {
    expect(down).toContain(
      "join backup.items_before_categories_20261031 b using (id) where i.type <> b.type;",
    );
    expect(down).toContain("raise exception 'rollback_categories: % itens com type diferente do backup'");
    expect(down).toContain("(select count(*) from backup.items_before_categories_20261031) as itens_no_backup");
  });
});
