import { execFileSync } from "node:child_process";
import { existsSync, mkdtempSync, rmSync } from "node:fs";
import { createServer } from "node:net";
import { tmpdir } from "node:os";
import { join } from "node:path";

// Postgres descartável para os testes de banco. Só roda com JUNTOS_PG_BIN
// apontando para a pasta com initdb/pg_ctl/postgres (com a extensão unaccent).
// O psql vem da mesma pasta, se existir, ou do PATH.
export const PG_BIN = process.env.JUNTOS_PG_BIN;

export type As = { as?: string; superuser?: boolean };

export type Pg = {
  run(script: string, options?: As): string;
  runFile(path: string): string;
  fails(script: string, options?: As): string;
  stop(): void;
};

// Stubs do Supabase que as migrations usam.
export const SUPABASE_STUBS = `
  create role anon nologin;
  create role authenticated nologin;
  create schema auth;
  create table auth.users (id uuid primary key, email text, raw_user_meta_data jsonb default '{}');
  create function auth.uid() returns uuid language sql stable as $$
    select nullif(current_setting('request.jwt.claims', true)::jsonb->>'sub', '')::uuid
  $$;
  grant usage on schema public, auth to authenticated;
  grant execute on function auth.uid() to authenticated;
`;

// Stub fiel do schema realtime do Supabase (só o que o Broadcast do banco
// usa): realtime.messages com RLS, realtime.topic() lendo o setting que o
// serviço Realtime põe ao checar a autorização, e broadcast_changes/send com
// o mesmo payload (operation/table/schema/record/old_record). Como no
// Supabase, falha ao gravar a mensagem vira warning e não derruba a
// transação de quem mudou a linha.
export const REALTIME_STUB = `
  create schema realtime;
  create table realtime.messages (
    id bigserial primary key,
    topic text not null,
    extension text not null,
    payload jsonb,
    event text,
    private boolean default true,
    inserted_at timestamptz default now()
  );
  alter table realtime.messages enable row level security;
  grant usage on schema realtime to authenticated;
  grant select on realtime.messages to authenticated;

  create function realtime.topic() returns text language sql stable as $$
    select nullif(current_setting('realtime.topic', true), '')
  $$;
  grant execute on function realtime.topic() to authenticated;

  create function realtime.send(payload jsonb, event text, topic text, private boolean default true)
  returns void language plpgsql as $$
  begin
    insert into realtime.messages (payload, event, topic, private, extension)
    values (payload, event, topic, private, 'broadcast');
  exception when others then
    raise warning 'ErrorSendingBroadcastMessage: %', sqlerrm;
  end;
  $$;

  create function realtime.broadcast_changes(
    topic_name text, event_name text, operation text, table_name text,
    table_schema text, new record, old record, level text default 'ROW'
  ) returns void language plpgsql as $$
  declare
    row_data jsonb := '{}'::jsonb;
  begin
    if level = 'STATEMENT' then
      raise exception 'function can only be triggered for each row, not for each statement';
    end if;
    if operation in ('INSERT', 'UPDATE', 'DELETE') then
      row_data := jsonb_build_object('old_record', old, 'record', new, 'operation', operation,
                                     'table', table_name, 'schema', table_schema);
      perform realtime.send(row_data, event_name, topic_name);
    else
      raise exception 'Unexpected operation type: %', operation;
    end if;
  exception when others then
    raise exception 'Failed to process the row: %', sqlerrm;
  end;
  $$;
`;

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

// { as } = como a pessoa logada (role authenticated + jwt);
// { as, superuser: true } = dono do banco, mas com auth.uid() da pessoa.
function prefix({ as, superuser }: As) {
  if (!as) return "";
  const claims = `set request.jwt.claims = '{"sub":"${as}"}';\n`;
  return superuser ? claims : `set role authenticated;\n${claims}`;
}

export async function startPg(bin: string): Promise<Pg> {
  const psqlBin = existsSync(join(bin, "psql")) ? join(bin, "psql") : "psql";
  const baseDir = mkdtempSync(join(tmpdir(), "juntos-pg-"));
  const dataDir = join(baseDir, "data");
  const port = await freePort();
  let started = false;

  const psql = (args: string[], input?: string) =>
    execFileSync(
      psqlBin,
      ["-X", "-q", "-t", "-A", "-v", "ON_ERROR_STOP=1", "-h", baseDir, "-p", String(port), "-U", "postgres", "-d", "postgres", ...args],
      { input, encoding: "utf8", stdio: ["pipe", "pipe", "pipe"] },
    );

  const pg: Pg = {
    run: (script, options = {}) => psql(["-f", "-"], prefix(options) + script).trim(),
    runFile: (path) => psql(["-f", path]),
    // Espera erro; devolve o stderr do psql.
    fails(script, options = {}) {
      try {
        pg.run(script, options);
      } catch (error) {
        return String((error as { stderr?: string }).stderr ?? error);
      }
      throw new Error(`deveria ter falhado: ${script}`);
    },
    stop() {
      if (started) {
        execFileSync(join(bin, "pg_ctl"), ["-D", dataDir, "-m", "immediate", "stop"], { stdio: "pipe" });
        started = false;
      }
      rmSync(baseDir, { recursive: true, force: true });
    },
  };

  try {
    execFileSync(join(bin, "initdb"), ["-D", dataDir, "-U", "postgres", "-A", "trust", "-E", "UTF8", "--no-locale", "--no-sync"], { stdio: "pipe" });
    execFileSync(
      join(bin, "pg_ctl"),
      ["-D", dataDir, "-w", "-l", join(baseDir, "postgres.log"), "-o", `-p ${port} -k ${baseDir} -c listen_addresses=''`, "start"],
      { stdio: "pipe" },
    );
    started = true;
  } catch (error) {
    pg.stop();
    throw error;
  }
  return pg;
}
