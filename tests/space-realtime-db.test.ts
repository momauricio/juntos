import { readdirSync } from "node:fs";
import { join } from "node:path";

import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

import { PG_BIN, REALTIME_STUB, SUPABASE_STUBS, startPg, type As, type Pg } from "./helpers/pg";

// Realtime do espaço (spec-layout-categorias.md §8, C9) num Postgres
// descartável de verdade, com um stub do schema realtime do Supabase
// (tests/helpers/pg.ts). Só roda com JUNTOS_PG_BIN:
//   JUNTOS_PG_BIN=/caminho/para/bin npx vitest run tests/space-realtime-db.test.ts

const MIGRATIONS_DIR = join(process.cwd(), "supabase/migrations");
const REALTIME_MIGRATION = "20261031140000_space_realtime.sql";
const ROLLBACK = join(process.cwd(), "supabase/rollback/20261031140000_space_realtime_down.sql");

const ANA = "00000000-0000-4000-8000-0000000000a1";
const BIA = "00000000-0000-4000-8000-0000000000a2";
const CAIO = "00000000-0000-4000-8000-0000000000a3";
const DUDA = "00000000-0000-4000-8000-0000000000a4";

let pg: Pg | undefined;
let casal = "";
let fora = "";

const run = (script: string, options: As = {}) => pg!.run(script, options);
const runFile = (path: string) => pg!.runFile(path);
const fails = (script: string, options: As = {}) => pg!.fails(script, options);

function createSpace(user: string, code: string): string {
  run(`insert into auth.users (id, email) values ('${user}', '${code.toLowerCase()}@x');`);
  return run(`select space_id from public.create_space_with_invite('Espaço ${code}', '${code}');`, { as: user });
}

// Mensagens gravadas (como o serviço Realtime vê): tópico|evento|tabela|operação.
function messages(): string[] {
  const out = run(`select string_agg(concat_ws('|', topic, event, payload->>'table', payload->>'operation'), E'\\n' order by id)
                   from realtime.messages;`);
  return out ? out.split("\n") : [];
}

// O que uma pessoa logada consegue ler no tópico. O Realtime autoriza o
// canal privado com um select em realtime.messages com realtime.topic
// definido, e só entrega as mensagens daquele tópico.
function readable(user: string, topic: string): string {
  return run(
    `select set_config('realtime.topic', '${topic}', false);
     select count(*) from realtime.messages where topic = '${topic}';`,
    { as: user },
  )
    .split("\n")
    .at(-1)!;
}

function categoryId(space: string, name: string): string {
  return run(`select id from public.categories where space_id = '${space}' and name = '${name}';`);
}

describe.skipIf(!PG_BIN)("realtime do espaço no Postgres de verdade", () => {
  beforeAll(async () => {
    pg = await startPg(PG_BIN!);
    run(SUPABASE_STUBS);
    run(REALTIME_STUB);

    const files = readdirSync(MIGRATIONS_DIR).filter((f) => f.endsWith(".sql")).sort();
    expect(files).toContain(REALTIME_MIGRATION);
    for (const file of files) {
      runFile(join(MIGRATIONS_DIR, file));
    }
    run("grant all on all tables in schema public to authenticated;");

    casal = createSpace(ANA, "CASAL1");
    run(`insert into auth.users (id, email) values ('${BIA}', 'bia@x');`);
    run(`select public.redeem_invite('CASAL1');`, { as: BIA });
    fora = createSpace(CAIO, "FORA01");
  }, 120_000);

  afterAll(() => {
    pg?.stop();
  });

  beforeEach(() => {
    run("truncate realtime.messages;");
  });

  it("insert, update e delete de item geram mensagem no tópico do espaço com a operação", () => {
    const id = run(`insert into public.items (space_id, type, title) values ('${casal}', 'restaurant', 'Cantina') returning id;`, {
      as: ANA,
    });
    run(`update public.items set title = 'Cantina 2' where id = '${id}';`, { as: BIA });
    run(`delete from public.items where id = '${id}';`, { as: ANA });

    expect(messages()).toEqual([
      `space:${casal}|INSERT|items|INSERT`,
      `space:${casal}|UPDATE|items|UPDATE`,
      `space:${casal}|DELETE|items|DELETE`,
    ]);
    // payload como o do Supabase: record no insert, old_record no delete
    expect(
      run(`select string_agg(concat_ws('|', coalesce(payload->'record'->>'title', ''), coalesce(payload->'old_record'->>'title', ''),
                                       extension, private),
                             E'\\n' order by id) from realtime.messages;`),
    ).toBe(["Cantina||broadcast|t", "Cantina 2|Cantina|broadcast|t", "|Cantina 2|broadcast|t"].join("\n"));
  });

  it("insert, update e delete de categoria geram mensagem", () => {
    const id = run(`insert into public.categories (space_id, name, emoji, color) values ('${casal}', 'Pubs', '🍺', 'ph1') returning id;`, {
      as: ANA,
    });
    run(`update public.categories set name = 'Bares' where id = '${id}';`, { as: BIA });
    run(`delete from public.categories where id = '${id}';`, { as: BIA });

    expect(messages()).toEqual([
      `space:${casal}|INSERT|categories|INSERT`,
      `space:${casal}|UPDATE|categories|UPDATE`,
      `space:${casal}|DELETE|categories|DELETE`,
    ]);
  });

  it("mover item de categoria e reordenar as categorias geram mensagem", () => {
    const pubs = run(`insert into public.categories (space_id, name, emoji, color) values ('${casal}', 'Pubs', '🍺', 'ph1') returning id;`, {
      as: ANA,
    });
    const item = run(`insert into public.items (space_id, type, title) values ('${casal}', 'activity', 'Karaokê') returning id;`, {
      as: ANA,
    });
    run("truncate realtime.messages;");

    run(`update public.items set category_id = '${pubs}' where id = '${item}';`, { as: BIA });
    expect(messages()).toEqual([`space:${casal}|UPDATE|items|UPDATE`]);
    expect(run(`select payload->'record'->>'category_id' from realtime.messages;`)).toBe(pubs);

    // Reordenar como lib/categories-data.ts: um update por categoria.
    run("truncate realtime.messages;");
    const ids = run(`select string_agg(id::text, ',' order by position desc) from public.categories where space_id = '${casal}';`).split(",");
    expect(ids).toHaveLength(9);
    run(ids.map((id, index) => `update public.categories set position = ${index + 1} where id = '${id}';`).join("\n"), { as: BIA });
    expect(messages()).toEqual(Array(9).fill(`space:${casal}|UPDATE|categories|UPDATE`));
    expect(run(`select position from public.categories where id = '${categoryId(casal, "Pubs")}';`)).toBe("1");
  });

  it("reordenar 8 categorias uma a uma: 8 mensagens e a mesma ordem final para os dois membros", () => {
    const ELA = "00000000-0000-4000-8000-0000000000b1";
    const ELE = "00000000-0000-4000-8000-0000000000b2";
    const espaco = createSpace(ELA, "ORDEM1");
    run(`insert into auth.users (id, email) values ('${ELE}', 'ele@x');`);
    run(`select public.redeem_invite('ORDEM1');`, { as: ELE });

    // A ordem como lib/categories-data.ts lista: position, created_at, id.
    const order = (user: string) =>
      run(
        `select string_agg(name, ',' order by position, created_at, id) from public.categories where space_id = '${espaco}';`,
        { as: user },
      );
    const ids = run(`select string_agg(id::text, ',' order by position desc) from public.categories where space_id = '${espaco}';`).split(",");
    expect(ids).toHaveLength(8);
    const reversed = order(ELA).split(",").reverse().join(",");
    run("truncate realtime.messages;");

    // moveCategories: um update de position por categoria (cada um é uma mensagem)
    run(ids.map((id, index) => `update public.categories set position = ${index + 1} where id = '${id}';`).join("\n"), { as: ELA });
    expect(messages()).toEqual(Array(8).fill(`space:${espaco}|UPDATE|categories|UPDATE`));
    expect(order(ELA)).toBe(reversed);
    expect(order(ELE)).toBe(order(ELA));
    // as semeadas nascem na mesma transação (mesmo created_at): com posição
    // empatada, quem decide é o id, igual para os dois
    expect(run(`select count(distinct created_at) from public.categories where space_id = '${espaco}';`)).toBe("1");
    run(`update public.categories set position = 1 where space_id = '${espaco}';`, { as: ELE });
    expect(order(ELE)).toBe(order(ELA));
    expect(order(ELA)).toBe(
      run(`select string_agg(name, ',' order by id) from public.categories where space_id = '${espaco}';`),
    );
  });

  it("insert, update e delete de nota geram mensagem no tópico do espaço do item", () => {
    const item = run(`insert into public.items (space_id, type, title, status) values ('${casal}', 'movie', 'Her', 'done') returning id;`, {
      as: ANA,
    });
    run("truncate realtime.messages;");

    run(`insert into public.ratings (item_id, rated_by, score) values ('${item}', '${ANA}', 8);`, { as: ANA });
    run(`update public.ratings set score = 9 where item_id = '${item}' and rated_by = '${ANA}';`, { as: ANA });
    run(`insert into public.ratings (item_id, rated_by, score) values ('${item}', '${BIA}', 7);`, { as: BIA });
    run(`delete from public.ratings where item_id = '${item}' and rated_by = '${BIA}';`, { as: BIA });

    expect(messages()).toEqual([
      `space:${casal}|INSERT|ratings|INSERT`,
      `space:${casal}|UPDATE|ratings|UPDATE`,
      `space:${casal}|INSERT|ratings|INSERT`,
      `space:${casal}|DELETE|ratings|DELETE`,
    ]);
    expect(run(`select payload->'record'->>'score' from realtime.messages where event = 'UPDATE';`)).toBe("9.0");
    expect(readable(BIA, `space:${casal}`)).toBe("4");
    expect(readable(CAIO, `space:${casal}`)).toBe("0");
  });

  it("nota pela RPC (Queremos -> Já fizemos) avisa o item e a nota", () => {
    const item = run(`insert into public.items (space_id, type, title) values ('${casal}', 'movie', 'Up') returning id;`, { as: ANA });
    run("truncate realtime.messages;");
    run(
      `select public.complete_item_with_rating('${item}', null::numeric, null::numeric, null::numeric, 8.5::numeric, null::text);`,
      { as: BIA },
    );
    expect([...messages()].sort()).toEqual([`space:${casal}|INSERT|ratings|INSERT`, `space:${casal}|UPDATE|items|UPDATE`]);
  });

  it("apagar item com notas: a cascata não quebra e só o delete do item avisa", () => {
    const item = run(`insert into public.items (space_id, type, title, status) values ('${casal}', 'movie', 'Coco', 'done') returning id;`, {
      as: ANA,
    });
    run(`insert into public.ratings (item_id, rated_by, score) values ('${item}', '${ANA}', 8);`, { as: ANA });
    run(`insert into public.ratings (item_id, rated_by, score) values ('${item}', '${BIA}', 6);`, { as: BIA });
    run("truncate realtime.messages;");

    run(`delete from public.items where id = '${item}';`, { as: BIA });
    expect(run(`select count(*) from public.ratings where item_id = '${item}';`)).toBe("0");
    expect(messages()).toEqual([`space:${casal}|DELETE|items|DELETE`]);
  });

  it("troca de espaço levando os itens avisa o espaço novo", () => {
    const antigo = createSpace(DUDA, "DUDA01");
    run(`insert into public.items (space_id, type, title) select '${antigo}', 'movie', 'Filme ' || g from generate_series(1, 3) g;`, {
      as: DUDA,
    });
    const destino = createSpace("00000000-0000-4000-8000-0000000000a5", "DESTI1");
    run("truncate realtime.messages;");

    expect(run("select public.switch_space_and_redeem('DESTI1', true);", { as: DUDA })).toBe(destino);
    expect(run(`select count(*) from realtime.messages where topic = 'space:${destino}' and payload->>'table' = 'items';`)).toBe("3");
    // as categorias padrão do espaço antigo somem junto com ele
    expect(run(`select count(*) from realtime.messages where topic = 'space:${antigo}' and event = 'DELETE';`)).toBe("8");
  });

  it("membro lê as mensagens do seu espaço; pessoa de fora não lê as do outro", () => {
    run(`insert into public.items (space_id, type, title) values ('${casal}', 'movie', 'Duna');`, { as: ANA });
    run(`insert into public.items (space_id, type, title) values ('${fora}', 'movie', 'Alien');`, { as: CAIO });

    expect(readable(ANA, `space:${casal}`)).toBe("1");
    expect(readable(BIA, `space:${casal}`)).toBe("1");
    expect(readable(CAIO, `space:${fora}`)).toBe("1");
    expect(readable(CAIO, `space:${casal}`)).toBe("0");
    expect(readable(ANA, `space:${fora}`)).toBe("0");
  });

  it.each(["space:abc", "foo", "", `space:${"0".repeat(32)}`, `xspace:00000000-0000-4000-8000-000000000000`])(
    "tópico inválido %j: zero linhas e nenhum erro",
    (topic) => {
      run(`insert into public.items (space_id, type, title) values ('${casal}', 'movie', 'Duna');`, { as: ANA });
      expect(readable(ANA, topic)).toBe("0");
    },
  );

  it("space_id_from_topic devolve o uuid ou null, sem erro", () => {
    expect(run(`select public.space_id_from_topic('space:${casal}');`)).toBe(casal);
    expect(run(`select public.space_id_from_topic('space:${casal.toUpperCase()}');`)).toBe(casal);
    expect(
      run(`select count(*) from unnest(array['space:abc', 'foo', '', null, 'space:${casal} ', 'space:${casal}x']) t
           where public.space_id_from_topic(t) is null;`),
    ).toBe("6");
  });

  it("cliente não escreve em realtime.messages nem chama o trigger; anon não usa space_id_from_topic", () => {
    // No Supabase, authenticated tem insert em realtime.messages; quem barra é a RLS.
    run("grant insert on realtime.messages to authenticated; grant usage on sequence realtime.messages_id_seq to authenticated;");
    expect(
      fails(`insert into realtime.messages (topic, extension, payload) values ('space:${casal}', 'broadcast', '{}');`, { as: ANA }),
    ).toContain("row-level security");
    expect(
      run(`select concat_ws('|',
             has_function_privilege('authenticated', 'public.broadcast_space_change()', 'execute'),
             has_function_privilege('anon', 'public.broadcast_space_change()', 'execute'),
             has_function_privilege('authenticated', 'public.broadcast_rating_change()', 'execute'),
             has_function_privilege('anon', 'public.broadcast_rating_change()', 'execute'),
             (select prosecdef from pg_proc where oid = 'public.broadcast_rating_change()'::regprocedure),
             has_function_privilege('authenticated', 'public.space_id_from_topic(text)', 'execute'),
             has_function_privilege('anon', 'public.space_id_from_topic(text)', 'execute'),
             (select prosecdef from pg_proc where oid = 'public.broadcast_space_change()'::regprocedure),
             (select provolatile from pg_proc where oid = 'public.space_id_from_topic(text)'::regprocedure));`),
    ).toBe("f|f|f|f|t|t|f|t|i");
  });

  it("não mexe na publicação supabase_realtime", () => {
    expect(run("select count(*) from pg_publication where pubname = 'supabase_realtime';")).toBe("0");
  });

  it("rollback remove triggers, política e funções; item e nota continuam funcionando", () => {
    runFile(ROLLBACK);
    expect(
      run(`select concat_ws('|',
             (select count(*) from pg_trigger where tgname in ('items_broadcast_changes', 'categories_broadcast_changes', 'ratings_broadcast_changes')),
             (select count(*) from pg_policies where schemaname = 'realtime' and tablename = 'messages'),
             to_regprocedure('public.broadcast_space_change()') is null,
             to_regprocedure('public.broadcast_rating_change()') is null,
             to_regprocedure('public.space_id_from_topic(text)') is null);`),
    ).toBe("0|0|t|t|t");

    run(`insert into public.items (space_id, type, title) values ('${casal}', 'movie', 'Depois do rollback');`, { as: ANA });
    expect(run(`select count(*) from public.items where title = 'Depois do rollback';`)).toBe("1");
    run(
      `insert into public.ratings (item_id, rated_by, score)
       select id, '${ANA}', 7 from public.items where title = 'Depois do rollback';`,
      { as: ANA },
    );
    expect(messages()).toEqual([]);
  });
});
