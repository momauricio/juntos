// Lógica pura da prévia de cidades do Trello (spec-layout-categorias.md §7).
// Só monta a lista para revisão; não grava nada. Ver scripts/cidades-trello-previa.mjs.

/**
 * @typedef {{ id: string, status: string, title: string }} BackupItem
 * @typedef {"separar" | "revisar" | "manter"} CityAction
 * @typedef {{
 *   id: string,
 *   status: string,
 *   titulo_atual: string,
 *   titulo_proposto: string,
 *   cidade_proposta: string,
 *   cidade_por_extenso_sugerida: string,
 *   acao: CityAction,
 *   motivo: string,
 * }} CityRow
 */

// Cidades conhecidas do casal (como-usamos-trello.md + região do Vale do
// Paranhana, Vale do Sinos e Serra). Nome por extenso com acento → apelidos
// que aparecem nos títulos. A comparação ignora acento e maiúscula.
/** @type {ReadonlyArray<readonly [string, ReadonlyArray<string>]>} */
export const KNOWN_CITIES = [
  ["Gramado", []],
  ["Canela", []],
  ["Novo Hamburgo", ["NH"]],
  ["Igrejinha", []],
  ["Rolante", []],
  ["Taquara", []],
  ["Parobé", []],
  ["Sapiranga", []],
  ["Ivoti", []],
  ["Três Coroas", []],
  ["Campo Bom", []],
  ["São Leopoldo", []],
  ["Estância Velha", []],
  ["Dois Irmãos", []],
  ["Nova Petrópolis", []],
  ["São Francisco de Paula", ["São Chico"]],
  ["Torres", []],
  ["Alvorada", []],
  ["Portão", []],
  ["Porto Alegre", ["POA"]],
  ["Caxias do Sul", []],
  ["Bento Gonçalves", []],
  ["Farroupilha", []],
  ["São Bento do Sul", []],
  ["Rio de Janeiro", ["RJ"]],
];

// Sem acento, minúscula, sem espaços nas pontas e espaços repetidos viram 1.
/** @param {string} value */
export function cityKey(value) {
  return value
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .trim()
    .replace(/\s+/g, " ")
    .toLowerCase();
}

/** @type {ReadonlyMap<string, string>} */
const CITY_BY_KEY = new Map(
  KNOWN_CITIES.flatMap(([name, aliases]) =>
    [name, ...aliases].map((alias) => /** @type {[string, string]} */ ([cityKey(alias), name])),
  ),
);

// Nome por extenso da cidade conhecida ("nh" → "Novo Hamburgo"); null se não for.
/** @param {string} value */
export function knownCity(value) {
  return CITY_BY_KEY.get(cityKey(value)) ?? null;
}

// "Lugar - Cidade": separa só no ÚLTIMO " - " (também " – " e " — "), com
// espaço dos dois lados. null quando não tem separador ou um dos lados fica vazio.
/** @param {string} title */
export function splitTitle(title) {
  const matches = [...title.matchAll(/\s+[-–—]\s+/g)];
  const last = matches.at(-1);

  if (!last || last.index === undefined) {
    return null;
  }

  const place = title.slice(0, last.index).trim();
  const city = title.slice(last.index + last[0].length).trim();

  return place && city ? { place, city } : null;
}

// Cidade conhecida colada no fim, sem separador ("Formaggio NH"): só vira dica no motivo.
/** @param {string} title */
function trailingKnownCity(title) {
  const words = title.trim().split(/\s+/);

  for (let take = Math.min(4, words.length - 1); take >= 1; take -= 1) {
    const tail = words.slice(-take).join(" ");
    if (knownCity(tail)) {
      return tail;
    }
  }

  return null;
}

/**
 * @param {BackupItem} item
 * @returns {CityRow}
 */
export function proposeCity(item) {
  const title = item.title.trim();
  const base = { id: item.id, status: item.status, titulo_atual: item.title };
  const split = splitTitle(title);

  if (!split) {
    const tail = trailingKnownCity(title);
    return {
      ...base,
      titulo_proposto: item.title,
      cidade_proposta: "",
      cidade_por_extenso_sugerida: "",
      acao: "manter",
      motivo: tail
        ? `sem separador; termina com “${tail}” (cidade conhecida), ver à mão`
        : "sem separador",
    };
  }

  const fullName = knownCity(split.city);

  return {
    ...base,
    titulo_proposto: split.place,
    cidade_proposta: split.city,
    cidade_por_extenso_sugerida: fullName ?? "",
    acao: fullName ? "separar" : "revisar",
    motivo: fullName
      ? "cidade conhecida depois do último separador"
      : `“${split.city}” não é cidade conhecida`,
  };
}

/** @param {unknown} data */
export function backupItems(data) {
  const items =
    data && typeof data === "object" && "items" in data ? data.items : null;

  if (!Array.isArray(items)) {
    throw new Error("JSON sem a lista \"items\".");
  }

  return items.map((raw, index) => {
    const item = /** @type {Record<string, unknown>} */ (raw ?? {});
    if (typeof item.id !== "string" || typeof item.title !== "string") {
      throw new Error(`Item ${index + 1} sem id ou title.`);
    }
    return /** @type {BackupItem} */ ({
      id: item.id,
      status: typeof item.status === "string" ? item.status : "",
      title: item.title,
    });
  });
}

/** @type {ReadonlyArray<keyof CityRow>} */
export const CSV_COLUMNS = [
  "id",
  "status",
  "titulo_atual",
  "titulo_proposto",
  "cidade_proposta",
  "cidade_por_extenso_sugerida",
  "acao",
  "motivo",
];

/** @param {string} value */
function csvField(value) {
  return /[",\r\n]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value;
}

// UTF-8 com BOM (o Excel abre com acento certo), vírgula e CRLF.
/** @param {ReadonlyArray<CityRow>} rows */
export function toCsv(rows) {
  const lines = [
    CSV_COLUMNS.join(","),
    ...rows.map((row) => CSV_COLUMNS.map((column) => csvField(row[column])).join(",")),
  ];
  return `﻿${lines.join("\r\n")}\r\n`;
}

/** @param {ReadonlyArray<CityRow>} rows */
export function summarize(rows) {
  /** @type {Record<CityAction, number>} */
  const counts = { separar: 0, revisar: 0, manter: 0 };
  for (const row of rows) {
    counts[row.acao] += 1;
  }
  return { total: rows.length, ...counts };
}
