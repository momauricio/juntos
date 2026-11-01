#!/usr/bin/env node
// Prévia das cidades do Trello (spec-layout-categorias.md §7). SÓ LISTA: lê um
// JSON de backup local e escreve um CSV com uma linha por item (título atual →
// título proposto + cidade). Não acessa rede nem banco e não muda nenhum item.
// Aplicar as cidades é OUTRO passo, só depois da revisão e com OK do Mauricio.
//
// Uso:
//   node scripts/cidades-trello-previa.mjs --entrada backup.json --saida previa.csv
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";

import { backupItems, proposeCity, summarize, toCsv } from "./lib/city-split.mjs";

/** @param {string[]} argv */
function parseArgs(argv) {
  /** @type {Record<string, string>} */
  const args = {};
  for (let index = 0; index < argv.length; index += 1) {
    const flag = argv[index];
    const value = argv[index + 1];
    if ((flag === "--entrada" || flag === "--saida") && value && !value.startsWith("--")) {
      args[flag.slice(2)] = value;
      index += 1;
    } else {
      throw new Error(`Argumento inesperado: ${flag}`);
    }
  }
  if (!args.entrada || !args.saida) {
    throw new Error("Use: --entrada <backup.json> --saida <previa.csv>");
  }
  if (resolve(args.entrada) === resolve(args.saida)) {
    throw new Error("--saida não pode ser o próprio backup.");
  }
  return { entrada: args.entrada, saida: args.saida };
}

try {
  const { entrada, saida } = parseArgs(process.argv.slice(2));
  const rows = backupItems(JSON.parse(readFileSync(entrada, "utf8"))).map(proposeCity);
  mkdirSync(dirname(resolve(saida)), { recursive: true });
  writeFileSync(saida, toCsv(rows), "utf8");

  const { total, separar, revisar, manter } = summarize(rows);
  console.log(`Prévia gravada em ${saida} (${total} itens; nada foi alterado no banco).`);
  console.log(`  separar: ${separar}`);
  console.log(`  revisar: ${revisar}`);
  console.log(`  manter:  ${manter}`);
} catch (error) {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
}
