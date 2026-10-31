// Conflito no mesmo item: vale a última gravação (sem bloqueio, sem merge) e
// quem grava por último fica sabendo. A detecção é no servidor, sem depender
// do Realtime: o formulário manda o updated_at que carregou e a action
// compara com o atual antes de gravar.

// ?mexeu={id do par} na volta para o item.
export const EDIT_CONFLICT_PARAM = "mexeu";

export function editConflictMessage(name: string): string {
  return `${name} também mexeu aqui. Mantivemos a sua versão.`;
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function isUuid(value: unknown): value is string {
  return typeof value === "string" && UUID.test(value);
}

// "2026-10-31T14:00:00.123456+00:00" → instante com microssegundos (o Date
// sozinho para nos milissegundos). null se não der para ler.
function instant(value: string): { ms: number; micros: string } | null {
  const ms = Date.parse(value);
  if (Number.isNaN(ms)) return null;
  const fraction = /\.(\d+)/.exec(value)?.[1] ?? "";
  return { ms, micros: fraction.padEnd(6, "0").slice(3, 6) };
}

// null = não deu para ler uma das datas.
function sameInstant(a: string, b: string): boolean | null {
  if (a === b) return true;
  const x = instant(a);
  const y = instant(b);
  if (x === null || y === null) return null;
  return x.ms === y.ms && x.micros === y.micros;
}

/**
 * Devolve o id de quem mexeu no item depois que esta tela carregou, ou null.
 * Só avisa se a versão mudou E a última gravação é de outra pessoa (gravar
 * por cima de si mesmo, em outra aba, não é conflito). Sem o updated_at
 * carregado (ou ilegível) ou sem updated_by não dá para afirmar nada: null.
 */
export function editConflictWith({
  loadedUpdatedAt,
  current,
  userId,
}: {
  loadedUpdatedAt: string | null | undefined;
  current: { updated_at: string; updated_by: string | null };
  userId: string;
}): string | null {
  if (!loadedUpdatedAt || sameInstant(loadedUpdatedAt, current.updated_at) !== false) return null;
  if (!current.updated_by || current.updated_by === userId) return null;
  return current.updated_by;
}
