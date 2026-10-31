import { execFileSync } from "node:child_process";
import { existsSync, mkdtempSync, readdirSync, rmSync } from "node:fs";
import { createServer } from "node:net";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterAll, beforeAll, describe, expect, it } from "vitest";

// Critérios de aceite · Banco (spec-layout-categorias.md) num Postgres
// descartável de verdade. Só roda com JUNTOS_PG_BIN apontando para a pasta
// com initdb/pg_ctl/postgres (com a extensão unaccent), por exemplo:
//   JUNTOS_PG_BIN=/caminho/para/bin npx vitest run tests/categories-db.test.ts
// O psql vem da mesma pasta, se existir, ou do PATH.
const PG_BIN = process.env.JUNTOS_PG_BIN;

const MIGRATIONS_DIR = join(process.cwd(), "supabase/migrations");
const CATEGORIES_MIGRATION = "20261031120000_categories.sql";
const ROLLBACK = join(process.cwd(), "supabase/rollback/20261031_categories_down.sql");

// Pessoas e espaços "de antes" da migration.
const MAURICIO = "dc615b01-9e66-4888-9451-3a44f1a6cea0";
const MANUELA = "b4005948-e5ac-49e0-8645-47692e228ce5";
const FORA = "00000000-0000-4000-8000-000000000003";
const BRISADOS = "a5abfb34-2ab6-4502-b375-15bd6a6dabff";
const ESPACO_FORA = "00000000-0000-4000-8000-0000000000f2";

// Criadas depois da migration.
const NOVA = "00000000-0000-4000-8000-000000000004";
const SAI = "00000000-0000-4000-8000-000000000005";
const ANA = "00000000-0000-4000-8000-000000000006";
const BETO = "00000000-0000-4000-8000-000000000007";
const CAIO = "00000000-0000-4000-8000-000000000008";
const DANI = "00000000-0000-4000-8000-000000000009";
const EVA = "00000000-0000-4000-8000-000000000010";
const FABIO = "00000000-0000-4000-8000-000000000011";

const TYPES = [
  "restaurant",
  "food_idea",
  "tourist_spot",
  "movie",
  "city",
  "event",
  "activity",
  "stay",
];

const DEFAULTS = [
  "1|Hospedagem|🏨|ph8|stay",
  "2|Restaurante|🍝|ph3|restaurant",
  "3|Passeio|🏖️|ph2|tourist_spot",
  "4|Programa|🧺|ph5|activity",
  "5|Comida|☕|ph1|food_idea",
  "6|Cidade|🏙️|ph4|city",
  "7|Filme|🎬|ph6|movie",
  "8|Evento|🎟️|ph7|event",
].join("\n");

let baseDir = "";
let dataDir = "";
let port = 0;
let psqlBin = "psql";
let started = false;
let snapshotBefore = "";

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

type As = { as?: string; superuser?: boolean };

// Roda um script no banco. { as } = como a pessoa logada (role authenticated
// + jwt); { as, superuser: true } = dono do banco, mas com auth.uid() da pessoa.
function prefix({ as, superuser }: As) {
  if (!as) return "";
  const claims = `set request.jwt.claims = '{"sub":"${as}"}';\n`;
  return superuser ? claims : `set role authenticated;\n${claims}`;
}

function run(script: string, options: As = {}): string {
  return execFileSync(
    psqlBin,
    ["-X", "-q", "-t", "-A", "-v", "ON_ERROR_STOP=1", "-h", baseDir, "-p", String(port), "-U", "postgres", "-d", "postgres", "-f", "-"],
    { input: prefix(options) + script, encoding: "utf8", stdio: ["pipe", "pipe", "pipe"] },
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
function fails(script: string, options: As = {}): string {
  try {
    run(script, options);
  } catch (error) {
    return String((error as { stderr?: string }).stderr ?? error);
  }
  throw new Error(`deveria ter falhado: ${script}`);
}

function categoryId(spaceId: string, name: string): string {
  return run(`select id from public.categories where space_id = '${spaceId}' and name = '${name}';`);
}

function createSpace(user: string, email: string, code: string): string {
  run(`insert into auth.users (id, email) values ('${user}', '${email}');`);
  return run(`select space_id from public.create_space_with_invite('Espaço ${code}', '${code}');`, {
    as: user,
  });
}

const SNAPSHOT = `select string_agg(concat_ws('|', id, type, status, updated_at, updated_by), E'\\n' order by id) from public.items;`;

describe.skipIf(!PG_BIN)("categorias no Postgres de verdade", () => {
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

    // Todas as migrations antes de categories.
    const files = readdirSync(MIGRATIONS_DIR).filter((f) => f.endsWith(".sql")).sort();
    expect(files).toContain(CATEGORIES_MIGRATION);
    for (const file of files.filter((f) => f < CATEGORIES_MIGRATION)) {
      runFile(join(MIGRATIONS_DIR, file));
    }
    run("grant all on all tables in schema public to authenticated;");

    // Dados "de antes": Brisados com os 8 tipos em want e done; outro espaço com 2 itens.
    run(`
      insert into auth.users (id, email) values
        ('${MAURICIO}', 'mauricio@x'), ('${MANUELA}', 'manuela@x'), ('${FORA}', 'fora@x');
      insert into public.spaces (id, name, created_by) values
        ('${BRISADOS}', 'Brisados da Madrugada', '${MAURICIO}'),
        ('${ESPACO_FORA}', 'Outro casal', '${FORA}');
      insert into public.space_members (space_id, user_id, role) values
        ('${BRISADOS}', '${MAURICIO}', 'owner'),
        ('${BRISADOS}', '${MANUELA}', 'member'),
        ('${ESPACO_FORA}', '${FORA}', 'owner');
    `);
    run(
      `insert into public.items (space_id, type, title, status)
       select '${BRISADOS}', t, 'Antigo ' || t || ' ' || s, s
       from unnest(array['${TYPES.join("','")}']) t, unnest(array['want', 'done']) s;`,
      { as: MAURICIO, superuser: true },
    );
    run(
      `insert into public.items (space_id, type, title) values
         ('${ESPACO_FORA}', 'restaurant', 'Do outro casal'), ('${ESPACO_FORA}', 'movie', 'Filme do outro');`,
      { as: FORA, superuser: true },
    );
    // Edição antiga feita pela Manuela (sem passar pelo trigger de autoria).
    run(`
      set session_replication_role = replica;
      update public.items
      set updated_at = '2025-01-02 03:04:05+00', updated_by = '${MANUELA}'
      where space_id = '${BRISADOS}';
      set session_replication_role = origin;
    `);
    snapshotBefore = run(SNAPSHOT);

    runFile(join(MIGRATIONS_DIR, CATEGORIES_MIGRATION));
    // As migrations depois de categories (se houver) também entram.
    for (const file of files.filter((f) => f > CATEGORIES_MIGRATION)) {
      runFile(join(MIGRATIONS_DIR, file));
    }
  }, 120_000);

  afterAll(() => {
    if (started) {
      execFileSync(join(PG_BIN!, "pg_ctl"), ["-D", dataDir, "-m", "immediate", "stop"], { stdio: "pipe" });
    }
    if (baseDir) rmSync(baseDir, { recursive: true, force: true });
  });

  it("migration: 8 categorias por espaço, todo item na categoria do seu tipo, autoria intacta", () => {
    for (const space of [BRISADOS, ESPACO_FORA]) {
      expect(
        run(`select string_agg(concat_ws('|', position, name, emoji, color, item_type), E'\\n' order by position)
             from public.categories where space_id = '${space}';`),
      ).toBe(DEFAULTS);
      expect(run(`select count(*) from public.categories where space_id = '${space}' and created_by is not null;`)).toBe("0");
    }
    expect(run("select count(*) from public.items where category_id is null;")).toBe("0");
    expect(run("select count(*) from public.items;")).toBe("18");
    expect(
      run(`select count(*) from public.items i join public.categories c on c.id = i.category_id
           where c.item_type <> i.type or c.space_id <> i.space_id;`),
    ).toBe("0");
    // updated_at/updated_by/type/status iguais aos de antes da migration.
    expect(run(SNAPSHOT)).toBe(snapshotBefore);
    expect(
      run(`select count(*) from backup.items_before_categories_20261031 b
           join public.items i using (id)
           where (i.type, i.status, i.updated_at, i.updated_by) is not distinct from (b.type, b.status, b.updated_at, b.updated_by);`),
    ).toBe("18");
    expect(
      run(`select is_nullable from information_schema.columns
           where table_schema = 'public' and table_name = 'items' and column_name = 'category_id';`),
    ).toBe("NO");
    expect(run("select count(*) from public.profiles where item_view = 'grid';")).toBe("3");
  });

  it("espaço novo por create_space_with_invite nasce com as 8, na ordem e com as cores", () => {
    const space = createSpace(NOVA, "nova@x", "NOVA01");
    expect(
      run(`select string_agg(concat_ws('|', position, name, emoji, color, item_type), E'\\n' order by position)
           from public.categories where space_id = '${space}';`),
    ).toBe(DEFAULTS);
    expect(run(`select count(*) from public.categories where space_id = '${space}' and created_by is null;`)).toBe("8");
  });

  it("insert sem category_id recebe a categoria do tipo (também pelo import_trello_items)", () => {
    const id = run(
      `insert into public.items (space_id, type, title) values ('${BRISADOS}', 'stay', 'Cabana nova') returning category_id;`,
      { as: MAURICIO },
    );
    expect(id).toBe(categoryId(BRISADOS, "Hospedagem"));

    run(
      `select * from public.import_trello_items('[
         {"type":"restaurant","status":"done","title":"Do Trello","source_ref":"card-1"},
         {"type":"event","status":"want","title":"Show","source_ref":"card-2"}
       ]'::jsonb);`,
      { as: MAURICIO },
    );
    expect(
      run(`select string_agg(c.name, ',' order by i.source_ref) from public.items i
           join public.categories c on c.id = i.category_id where i.source_ref in ('card-1', 'card-2');`),
    ).toBe("Restaurante,Evento");
  });

  it("category_id de outro espaço falha com category_other_space (insert e update)", () => {
    const other = categoryId(ESPACO_FORA, "Restaurante");
    expect(
      fails(
        `insert into public.items (space_id, type, title, category_id)
         values ('${BRISADOS}', 'restaurant', 'Intruso', '${other}');`,
        { as: MAURICIO },
      ),
    ).toContain("category_other_space");
    expect(
      fails(
        `update public.items set category_id = '${other}'
         where space_id = '${BRISADOS}' and title = 'Antigo restaurant want';`,
        { as: MAURICIO },
      ),
    ).toContain("category_other_space");
    // Mudar o item de espaço sem trocar a categoria também não passa.
    expect(
      fails(`update public.items set space_id = '${ESPACO_FORA}' where title = 'Antigo movie want';`),
    ).toContain("category_other_space");
  });

  it("apagar categoria com 1 item (want ou done) falha com category_not_empty; vazia apaga", () => {
    run(
      `insert into public.categories (space_id, name, emoji, color) values ('${BRISADOS}', 'Temporária', '🧪', 'ph1');`,
      { as: MAURICIO },
    );
    const temp = categoryId(BRISADOS, "Temporária");
    run(
      `insert into public.items (space_id, type, title, category_id)
       values ('${BRISADOS}', 'activity', 'Só um', '${temp}');`,
      { as: MANUELA },
    );

    const deleteTemp = `delete from public.categories where id = '${temp}';`;
    expect(fails(deleteTemp, { as: MAURICIO })).toContain("category_not_empty");

    run(`update public.items set status = 'done' where title = 'Só um';`, { as: MANUELA });
    expect(fails(deleteTemp, { as: MAURICIO })).toContain("category_not_empty");

    run(
      `update public.items set category_id = '${categoryId(BRISADOS, "Programa")}' where title = 'Só um';`,
      { as: MANUELA },
    );
    expect(
      run(`with d as (delete from public.categories where id = '${temp}' returning 1) select count(*) from d;`, {
        as: MAURICIO,
      }),
    ).toBe("1");
  });

  it("delete from spaces / leave_space apagam itens e categorias sem erro", () => {
    const space = createSpace(SAI, "sai@x", "SAI001");
    run(
      `insert into public.categories (space_id, name, emoji, color) values ('${space}', 'Bares', '🍺', 'ph5');
       insert into public.items (space_id, type, title) values ('${space}', 'stay', 'Pousada'), ('${space}', 'movie', 'Filme');
       insert into public.items (space_id, type, title, category_id)
       select '${space}', 'restaurant', 'Bar do Zé', id from public.categories where space_id = '${space}' and name = 'Bares';`,
      { as: SAI },
    );
    expect(run("select public.leave_space();", { as: SAI })).toBe("deleted");
    expect(
      run(`select (select count(*) from public.items where space_id = '${space}')
                + (select count(*) from public.categories where space_id = '${space}')
                + (select count(*) from public.spaces where id = '${space}');`),
    ).toBe("0");

    // A ordem do cascade segue o nome dos triggers RI (oid): força as
    // categorias a caírem ANTES dos itens recriando a FK items -> spaces.
    expect(
      run(`
        begin;
        alter table public.items drop constraint items_space_id_fkey;
        alter table public.items add constraint items_space_id_fkey
          foreign key (space_id) references public.spaces (id) on delete cascade;
        delete from public.spaces where id = '${ESPACO_FORA}';
        select (select count(*) from public.items where space_id = '${ESPACO_FORA}')
             + (select count(*) from public.categories where space_id = '${ESPACO_FORA}');
        rollback;
      `),
    ).toBe("0");
    expect(run(`select count(*) from public.categories where space_id = '${ESPACO_FORA}';`)).toBe("8");
  });

  it('"Pubs" e depois "púbs " no mesmo espaço: o 2º falha; "Pubs" em outro espaço funciona', () => {
    const created = run(
      `insert into public.categories (space_id, name, emoji, color) values ('${BRISADOS}', 'Pubs', '🍺', 'ph5')
       returning concat_ws('|', name, name_key, position, item_type, created_by);`,
      { as: MAURICIO },
    );
    expect(created).toBe(`Pubs|pubs|9|activity|${MAURICIO}`);
    const error = fails(
      `insert into public.categories (space_id, name, emoji, color) values ('${BRISADOS}', ' púbs ', '🍻', 'ph1');`,
      { as: MANUELA },
    );
    expect(error).toContain("categories_space_name_key_unique");
    expect(
      run(
        `insert into public.categories (space_id, name, emoji, color) values ('${ESPACO_FORA}', 'Pubs', '🍺', 'ph5') returning name;`,
        { as: FORA },
      ),
    ).toBe("Pubs");
    // Renomear para o próprio nome mudando só maiúscula é permitido.
    expect(
      run(`update public.categories set name = 'PUBS ' where space_id = '${BRISADOS}' and name = 'Pubs' returning name;`, {
        as: MANUELA,
      }),
    ).toBe("PUBS");
    run(`update public.categories set name = 'Pubs' where space_id = '${BRISADOS}' and name = 'PUBS';`, { as: MANUELA });
  });

  it("nome vazio, nome com 25 caracteres, cor ph9 e a 31ª categoria são recusados", () => {
    const insert = (name: string, color = "ph1") =>
      `insert into public.categories (space_id, name, emoji, color) values ('${ESPACO_FORA}', '${name}', '⭐', '${color}');`;
    expect(fails(insert("   "), { as: FORA })).toContain("categories_name_check");
    expect(fails(insert("a".repeat(25)), { as: FORA })).toContain("categories_name_check");
    expect(fails(insert("Cor errada", "ph9"), { as: FORA })).toContain("categories_color_check");

    // 8 padrão + Pubs = 9; mais 21 = 30.
    run(
      `insert into public.categories (space_id, name, emoji, color)
       select '${ESPACO_FORA}', 'Extra ' || g, '⭐', 'ph1' from generate_series(1, 21) g;`,
      { as: FORA },
    );
    expect(run(`select count(*), max(position) from public.categories where space_id = '${ESPACO_FORA}';`)).toBe("30|30");
    expect(fails(insert("A trigésima primeira"), { as: FORA })).toContain("category_limit");
    run(`delete from public.categories where space_id = '${ESPACO_FORA}' and name like 'Extra %';`, { as: FORA });
  });

  it("pessoa de fora não lê, não cria, não edita e não apaga categoria (RLS)", () => {
    const before = run(`select count(*) from public.categories where space_id = '${BRISADOS}';`);
    expect(run(`select count(*) from public.categories where space_id = '${BRISADOS}';`, { as: FORA })).toBe("0");
    expect(
      fails(
        `insert into public.categories (space_id, name, emoji, color) values ('${BRISADOS}', 'Invasão', '🏴', 'ph1');`,
        { as: FORA },
      ),
    ).toContain("row-level security");
    expect(
      run(
        `with u as (update public.categories set name = 'Hackeado' where space_id = '${BRISADOS}' returning 1) select count(*) from u;`,
        { as: FORA },
      ),
    ).toBe("0");
    expect(
      run(
        `with d as (delete from public.categories where space_id = '${BRISADOS}' returning 1) select count(*) from d;`,
        { as: FORA },
      ),
    ).toBe("0");
    expect(run(`select count(*) from public.categories where space_id = '${BRISADOS}' and name = 'Hackeado';`)).toBe("0");
    expect(run(`select count(*) from public.categories where space_id = '${BRISADOS}';`)).toBe(before);

    // anon não tem acesso nenhum; funções internas e backup fechados.
    expect(fails("set role anon; select count(*) from public.categories;")).toContain("permission denied");
    expect(
      run(`select bool_or(has_function_privilege(r, f, 'execute'))
           from unnest(array['anon', 'authenticated']) r,
                unnest(array[
                  'public.category_name_key(text)', 'public.categories_normalize()',
                  'public.categories_enforce_limit()', 'public.categories_prevent_delete_non_empty()',
                  'public.seed_default_categories(uuid)', 'public.spaces_seed_categories()',
                  'public.items_fill_category()', 'public.items_category_same_space()'
                ]) f;`),
    ).toBe("f");
    expect(
      run(`select has_function_privilege('authenticated', 'public.switch_space_and_redeem(text, boolean)', 'execute'),
                  has_function_privilege('anon', 'public.switch_space_and_redeem(text, boolean)', 'execute'),
                  has_schema_privilege('authenticated', 'backup', 'usage'),
                  has_schema_privilege('anon', 'backup', 'usage');`),
    ).toBe("t|f|f|f");
    expect(fails("select public.seed_default_categories(gen_random_uuid());", { as: MAURICIO })).toContain(
      "permission denied",
    );
  });

  it("space_id, item_type e created_by não mudam no update", () => {
    const pubs = categoryId(BRISADOS, "Pubs");
    expect(
      fails(`update public.categories set space_id = '${ESPACO_FORA}' where id = '${pubs}';`, { as: MAURICIO }),
    ).toContain("category_space_immutable");
    expect(
      fails(`update public.categories set item_type = 'restaurant' where id = '${pubs}';`, { as: MAURICIO }),
    ).toContain("category_item_type_immutable");
    expect(
      fails(`update public.categories set created_by = '${MANUELA}' where id = '${pubs}';`, { as: MAURICIO }),
    ).toContain("created_by_immutable");
    // Pelo dono do banco também (é trigger, não RLS).
    expect(fails(`update public.categories set space_id = '${ESPACO_FORA}' where id = '${pubs}';`)).toContain(
      "category_space_immutable",
    );
    // Editar nome/emoji/cor funciona e atualiza updated_at.
    expect(
      run(
        `update public.categories set emoji = '🍻', color = 'ph7', updated_at = '2000-01-01'
         where id = '${pubs}' returning emoji || color || (updated_at > now() - interval '1 minute');`,
        { as: MANUELA },
      ),
    ).toBe("🍻ph7true");
  });

  it("categoria própria activity antes de Programa não rouba o fallback", () => {
    run(`update public.categories set position = 0 where space_id = '${BRISADOS}' and name = 'Pubs';`, {
      as: MAURICIO,
    });
    expect(
      run(`select string_agg(name, ',' order by position, created_at) from public.categories
           where space_id = '${BRISADOS}' and item_type = 'activity';`),
    ).toBe("Pubs,Programa");
    expect(
      run(
        `insert into public.items (space_id, type, title) values ('${BRISADOS}', 'activity', 'Piquenique') returning category_id;`,
        { as: MANUELA },
      ),
    ).toBe(categoryId(BRISADOS, "Programa"));
    // Mover um restaurante para Pubs mantém o tipo.
    expect(
      run(
        `update public.items set category_id = '${categoryId(BRISADOS, "Pubs")}'
         where title = 'Antigo restaurant done' returning type || '|' || (updated_by = '${MAURICIO}');`,
        { as: MAURICIO },
      ),
    ).toBe("restaurant|true");
  });

  it("switch_space_and_redeem(code, true) leva Pubs e os itens para o espaço novo", () => {
    const oldSpace = createSpace(ANA, "ana@x", "ANA001");
    const newSpace = createSpace(BETO, "beto@x", "BETO01");
    run(
      `insert into public.categories (space_id, name, emoji, color) values ('${oldSpace}', 'Pubs', '🍺', 'ph5');
       insert into public.items (space_id, type, title) values ('${oldSpace}', 'restaurant', 'Cantina'), ('${oldSpace}', 'stay', 'Hotel');
       insert into public.items (space_id, type, title, category_id)
       select '${oldSpace}', 'activity', 'Pub da esquina', id from public.categories where space_id = '${oldSpace}' and name = 'Pubs';`,
      { as: ANA },
    );

    expect(run("select public.switch_space_and_redeem('beto01', true);", { as: ANA })).toBe(newSpace);

    expect(
      run(`select (select count(*) from public.spaces where id = '${oldSpace}')
                + (select count(*) from public.categories where space_id = '${oldSpace}')
                + (select count(*) from public.items where space_id = '${oldSpace}');`),
    ).toBe("0");
    expect(
      run(`select concat_ws('|', position, emoji, color, item_type, created_by) from public.categories
           where space_id = '${newSpace}' and name = 'Pubs';`),
    ).toBe(`9|🍺|ph5|activity|${ANA}`);
    expect(run(`select count(*) from public.categories where space_id = '${newSpace}';`)).toBe("9");
    expect(
      run(`select string_agg(i.title || '>' || c.name, ',' order by i.title) from public.items i
           join public.categories c on c.id = i.category_id
           where i.space_id = '${newSpace}' and c.space_id = '${newSpace}';`),
    ).toBe("Cantina>Restaurante,Hotel>Hospedagem,Pub da esquina>Pubs");
    expect(run(`select space_id from public.space_members where user_id = '${ANA}';`)).toBe(newSpace);
  });

  it("switch_space_and_redeem(code, false) continua apagando o espaço antigo", () => {
    const oldSpace = createSpace(CAIO, "caio@x", "CAIO01");
    const newSpace = createSpace(DANI, "dani@x", "DANI01");
    run(`insert into public.items (space_id, type, title) values ('${oldSpace}', 'movie', 'Filme do Caio');`, { as: CAIO });

    expect(run("select public.switch_space_and_redeem('DANI01', false);", { as: CAIO })).toBe(newSpace);
    expect(
      run(`select (select count(*) from public.spaces where id = '${oldSpace}')
                + (select count(*) from public.categories where space_id = '${oldSpace}')
                + (select count(*) from public.items where title = 'Filme do Caio');`),
    ).toBe("0");
    expect(run(`select count(*) from public.categories where space_id = '${newSpace}';`)).toBe("8");
  });

  it("rollback volta ao esquema anterior e items.type fica igual ao backup", () => {
    const output = runFile(ROLLBACK);
    expect(output).toContain("|0");

    expect(
      run(`select concat_ws('|',
             to_regclass('public.categories') is null,
             (select count(*) from information_schema.columns
               where table_schema = 'public' and table_name = 'items' and column_name = 'category_id'),
             (select count(*) from information_schema.columns
               where table_schema = 'public' and table_name = 'profiles' and column_name = 'item_view'),
             (select count(*) from pg_proc p join pg_namespace n on n.oid = p.pronamespace
               where n.nspname = 'public' and p.proname in (
                 'category_name_key', 'categories_normalize', 'categories_enforce_limit',
                 'categories_prevent_delete_non_empty', 'seed_default_categories',
                 'spaces_seed_categories', 'items_fill_category', 'items_category_same_space')),
             (select count(*) from pg_trigger where tgname in ('spaces_seed_categories', 'items_fill_category', 'items_category_same_space')),
             (select count(*) from pg_extension where extname = 'unaccent'),
             to_regclass('backup.items_before_categories_20261031') is not null);`),
    ).toBe("t|0|0|0|0|1|t");

    expect(
      run(`select count(*) from public.items i join backup.items_before_categories_20261031 b using (id)
           where i.type <> b.type;`),
    ).toBe("0");
    expect(run("select prosrc not like '%categories%' from pg_proc where proname = 'switch_space_and_redeem';")).toBe("t");

    // switch_space_and_redeem(true) volta a funcionar sem categories.
    const oldSpace = createSpace(EVA, "eva@x", "EVA001");
    const newSpace = createSpace(FABIO, "fabio@x", "FABIO1");
    run(`insert into public.items (space_id, type, title) values ('${oldSpace}', 'city', 'Gramado');`, { as: EVA });
    expect(run("select public.switch_space_and_redeem('FABIO1', true);", { as: EVA })).toBe(newSpace);
    expect(run(`select space_id from public.items where title = 'Gramado';`)).toBe(newSpace);
    expect(run(`select count(*) from public.spaces where id = '${oldSpace}';`)).toBe("0");
  });
});
