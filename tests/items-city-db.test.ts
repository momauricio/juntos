import { execFileSync } from "node:child_process";
import { existsSync, mkdtempSync, readdirSync, rmSync } from "node:fs";
import { createServer } from "node:net";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterAll, beforeAll, describe, expect, it } from "vitest";

// items.city (spec-layout-categorias.md §7) num Postgres descartável de
// verdade. Mesmo harness de tests/categories-db.test.ts; só roda com
// JUNTOS_PG_BIN apontando para a pasta com initdb/pg_ctl/postgres:
//   JUNTOS_PG_BIN=/caminho/para/bin npx vitest run tests/items-city-db.test.ts
// O psql vem da mesma pasta, se existir, ou do PATH.
const PG_BIN = process.env.JUNTOS_PG_BIN;

const MIGRATIONS_DIR = join(process.cwd(), "supabase/migrations");
const CITY_MIGRATION = "20261031150000_items_city.sql";
const ROLLBACK = join(process.cwd(), "supabase/rollback/20261031150000_items_city_down.sql");

const MAURICIO = "dc615b01-9e66-4888-9451-3a44f1a6cea0";

let baseDir = "";
let dataDir = "";
let port = 0;
let psqlBin = "psql";
let started = false;
let spaceId = "";
let schemaBefore = "";
let itemsBefore = "";

function freePort(): Promise<number> {
  return new Promise((resolve, reject) => {
    const server = createServer();
    server.unref();
    server.on("error", reject);
    server.listen(0, "127.0.0.1", () => {
      const address = server.address();
      server.close(() => resolve(typeof address === "object" && address ? address.port : 0));
    });
  });
}

// { as } = como a pessoa logada (role authenticated + jwt), igual ao app.
function prefix(as?: string) {
  return as ? `set role authenticated;\nset request.jwt.claims = '{"sub":"${as}"}';\n` : "";
}

function run(script: string, as?: string): string {
  return execFileSync(
    psqlBin,
    ["-X", "-q", "-t", "-A", "-v", "ON_ERROR_STOP=1", "-h", baseDir, "-p", String(port), "-U", "postgres", "-d", "postgres", "-f", "-"],
    { input: prefix(as) + script, encoding: "utf8", stdio: ["pipe", "pipe", "pipe"] },
  ).trim();
}

function runFile(path: string): string {
  return execFileSync(
    psqlBin,
    ["-X", "-q", "-t", "-A", "-v", "ON_ERROR_STOP=1", "-h", baseDir, "-p", String(port), "-U", "postgres", "-d", "postgres", "-f", path],
    { encoding: "utf8", stdio: ["pipe", "pipe", "pipe"] },
  );
}

// Espera erro; devolve o stderr do psql.
function fails(script: string, as?: string): string {
  try {
    run(script, as);
  } catch (error) {
    return String((error as { stderr?: string }).stderr ?? error);
  }
  throw new Error(`deveria ter falhado: ${script}`);
}

function insertItem(title: string, city: string | null): string {
  const value = city === null ? "null" : `'${city}'`;
  return run(
    `insert into public.items (space_id, type, title, city)
     values ('${spaceId}', 'restaurant', '${title}', ${value}) returning id;`,
    MAURICIO,
  );
}

// Colunas e constraints de items: o rollback tem que voltar a isto.
const SCHEMA = `select concat_ws(E'\\n',
  (select string_agg(concat_ws('|', column_name, data_type, is_nullable, column_default), E'\\n' order by column_name)
   from information_schema.columns where table_schema = 'public' and table_name = 'items'),
  (select string_agg(conname || '|' || pg_get_constraintdef(oid), E'\\n' order by conname)
   from pg_constraint where conrelid = 'public.items'::regclass));`;

const ITEMS = `select string_agg(concat_ws('|', id, type, title, status, category_id, updated_at), E'\\n' order by id) from public.items;`;

describe.skipIf(!PG_BIN)("items.city no Postgres de verdade", () => {
  beforeAll(async () => {
    const bin = PG_BIN!;
    psqlBin = existsSync(join(bin, "psql")) ? join(bin, "psql") : "psql";
    baseDir = mkdtempSync(join(tmpdir(), "juntos-pg-"));
    dataDir = join(baseDir, "data");
    port = await freePort();

    execFileSync(join(bin, "initdb"), ["-D", dataDir, "-U", "postgres", "-A", "trust", "-E", "UTF8", "--no-locale", "--no-sync"], { stdio: "pipe" });
    execFileSync(
      join(bin, "pg_ctl"),
      ["-D", dataDir, "-w", "-l", join(baseDir, "postgres.log"), "-o", `-p ${port} -k ${baseDir} -c listen_addresses=''`, "start"],
      { stdio: "pipe" },
    );
    started = true;

    // Stubs do Supabase.
    run(`
      create role anon nologin;
      create role authenticated nologin;
      create schema auth;
      create table auth.users (id uuid primary key, email text, raw_user_meta_data jsonb default '{}');
      create function auth.uid() returns uuid language sql stable as $$
        select nullif(current_setting('request.jwt.claims', true)::jsonb->>'sub', '')::uuid
      $$;
      grant usage on schema public, auth to authenticated;
      grant execute on function auth.uid() to authenticated;
    `);

    // Todas as migrations antes da cidade; um espaço com itens "de antes".
    const files = readdirSync(MIGRATIONS_DIR).filter((f) => f.endsWith(".sql")).sort();
    expect(files).toContain(CITY_MIGRATION);
    for (const file of files.filter((f) => f < CITY_MIGRATION)) {
      runFile(join(MIGRATIONS_DIR, file));
    }
    run("grant all on all tables in schema public to authenticated;");

    run(`insert into auth.users (id, email) values ('${MAURICIO}', 'mauricio@x');`);
    spaceId = run(`select space_id from public.create_space_with_invite('Brisados da Madrugada', 'CIDADE');`, MAURICIO);
    run(
      `insert into public.items (space_id, type, title, status) values
         ('${spaceId}', 'stay', 'Montt Sierra Cabanas - Igrejinha', 'want'),
         ('${spaceId}', 'restaurant', 'Cantina antiga', 'done');`,
      MAURICIO,
    );
    schemaBefore = run(SCHEMA);
    itemsBefore = run(ITEMS);

    // A cidade e as migrations depois dela (se houver).
    for (const file of files.filter((f) => f >= CITY_MIGRATION)) {
      runFile(join(MIGRATIONS_DIR, file));
    }
  }, 120_000);

  afterAll(() => {
    if (started) {
      execFileSync(join(PG_BIN!, "pg_ctl"), ["-D", dataDir, "-m", "immediate", "stop"], { stdio: "pipe" });
    }
    if (baseDir) rmSync(baseDir, { recursive: true, force: true });
  });

  it("migration: coluna nula, sem default, e nenhum item muda", () => {
    expect(
      run(`select concat_ws('|', data_type, is_nullable, coalesce(column_default, '-'))
           from information_schema.columns
           where table_schema = 'public' and table_name = 'items' and column_name = 'city';`),
    ).toBe("text|YES|-");
    expect(run("select count(*) from public.items where city is not null;")).toBe("0");
    expect(run(ITEMS)).toBe(itemsBefore);
  });

  it("aceita null e 'Gramado' (insert pelo app, como a pessoa logada)", () => {
    const semCidade = insertItem("Sem cidade", null);
    const gramado = insertItem("Café Colonial", "Gramado");
    expect(run(`select coalesce(city, '<null>') from public.items where id = '${semCidade}';`)).toBe("<null>");
    expect(run(`select city from public.items where id = '${gramado}';`)).toBe("Gramado");
    // 60 caracteres (com acento) ainda passa.
    const sessenta = "Ã".repeat(60);
    expect(run(`select city from public.items where id = '${insertItem("Limite", sessenta)}';`)).toBe(sessenta);
  });

  it("recusa '', espaço nas pontas e 61 caracteres", () => {
    for (const city of ["", "  Gramado", "Gramado ", "a".repeat(61)]) {
      expect(fails(
        `insert into public.items (space_id, type, title, city) values ('${spaceId}', 'restaurant', 'Ruim', '${city}');`,
        MAURICIO,
      )).toContain("items_city_check");
    }
  });

  it("insert sem city (app antigo, import_trello_items) continua", () => {
    const id = run(
      `insert into public.items (space_id, type, title) values ('${spaceId}', 'movie', 'Filme') returning id;`,
      MAURICIO,
    );
    expect(run(`select coalesce(city, '<null>') from public.items where id = '${id}';`)).toBe("<null>");
    expect(run(`select inserted from public.import_trello_items('[]'::jsonb);`, MAURICIO)).toBe("0");
  });

  it("update pelo app: grava, troca e limpa a cidade; editar outro campo não mexe nela", () => {
    const id = run(`select id from public.items where title = 'Montt Sierra Cabanas - Igrejinha';`);
    run(`update public.items set city = 'Igrejinha' where id = '${id}';`, MAURICIO);
    expect(run(`select concat_ws('|', city, updated_by) from public.items where id = '${id}';`)).toBe(`Igrejinha|${MAURICIO}`);
    run(`update public.items set title = 'Montt Sierra Cabanas' where id = '${id}';`, MAURICIO);
    expect(run(`select city from public.items where id = '${id}';`)).toBe("Igrejinha");
    expect(fails(`update public.items set city = ' Igrejinha' where id = '${id}';`, MAURICIO)).toContain("items_city_check");
    run(`update public.items set city = null where id = '${id}';`, MAURICIO);
    expect(run(`select coalesce(city, '<null>') from public.items where id = '${id}';`)).toBe("<null>");
    run(`update public.items set city = 'Igrejinha' where id = '${id}';`, MAURICIO);
  });

  it("rollback: volta ao esquema de antes e os itens ficam (sem a cidade)", () => {
    const count = run("select count(*) from public.items;");
    runFile(ROLLBACK);
    expect(run(SCHEMA)).toBe(schemaBefore);
    expect(run("select count(*) from public.items;")).toBe(count);
    // Os 2 itens de antes continuam iguais (o título editado no teste acima fica editado).
    expect(run(`select count(*) from public.items where title in ('Montt Sierra Cabanas', 'Cantina antiga');`)).toBe("2");
    // Insert do app sem cidade continua; e a migration aplica de novo.
    run(`insert into public.items (space_id, type, title) values ('${spaceId}', 'event', 'Depois do rollback');`, MAURICIO);
    runFile(join(MIGRATIONS_DIR, CITY_MIGRATION));
    expect(run("select count(*) from public.items where city is not null;")).toBe("0");
  });
});
