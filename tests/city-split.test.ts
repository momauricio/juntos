import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import {
  backupItems,
  CSV_COLUMNS,
  knownCity,
  proposeCity,
  splitTitle,
  summarize,
  toCsv,
} from "../scripts/lib/city-split.mjs";

const item = (title: string, status = "want") => ({ id: "id-1", status, title });

describe("splitTitle", () => {
  it("separa no ÚLTIMO separador, com hífen, meia-risca e travessão", () => {
    expect(splitTitle("Salto Ventoso - Farroupilha")).toEqual({ place: "Salto Ventoso", city: "Farroupilha" });
    expect(splitTitle("Bar – Gramado")).toEqual({ place: "Bar", city: "Gramado" });
    expect(splitTitle("Bar — Gramado")).toEqual({ place: "Bar", city: "Gramado" });
    expect(splitTitle("Bread Street - Gordom - Londres")).toEqual({ place: "Bread Street - Gordom", city: "Londres" });
    expect(splitTitle("A - B – C")).toEqual({ place: "A - B", city: "C" });
  });

  it("só com espaço dos dois lados; hífen dentro da palavra não separa", () => {
    expect(splitTitle("Pi-Square")).toBeNull();
    expect(splitTitle("Bar -Gramado")).toBeNull();
    expect(splitTitle("Formaggio NH")).toBeNull();
  });

  it("faz trim dos dois lados", () => {
    expect(splitTitle("Bar   -   São Chico ")).toEqual({ place: "Bar", city: "São Chico" });
  });
});

describe("knownCity", () => {
  it("ignora acento e maiúscula e devolve o nome por extenso", () => {
    expect(knownCity("nh")).toBe("Novo Hamburgo");
    expect(knownCity("portao")).toBe("Portão");
    expect(knownCity("Tres Coroas")).toBe("Três Coroas");
    expect(knownCity("sao chico")).toBe("São Francisco de Paula");
    expect(knownCity("RJ")).toBe("Rio de Janeiro");
    expect(knownCity(" torres ")).toBe("Torres");
    expect(knownCity("São Bento do Sul")).toBe("São Bento do Sul");
  });

  it("o que não é cidade conhecida dá null", () => {
    expect(knownCity("fondue")).toBeNull();
    expect(knownCity("Oktober")).toBeNull();
    expect(knownCity("Cascata das 3 quedas")).toBeNull();
  });
});

describe("proposeCity", () => {
  it("separar: direita é cidade conhecida (cidade como está, sugestão por extenso)", () => {
    expect(proposeCity(item("Mucho gusto - nh", "done"))).toEqual({
      id: "id-1",
      status: "done",
      titulo_atual: "Mucho gusto - nh",
      titulo_proposto: "Mucho gusto",
      cidade_proposta: "nh",
      cidade_por_extenso_sugerida: "Novo Hamburgo",
      acao: "separar",
      motivo: "cidade conhecida depois do último separador",
    });
    expect(proposeCity(item("Encantos da fazendinha - portao"))).toMatchObject({
      cidade_proposta: "portao",
      cidade_por_extenso_sugerida: "Portão",
      acao: "separar",
    });
  });

  it("revisar: tem separador, mas a direita não é cidade conhecida", () => {
    for (const [title, place, right] of [
      ["Chateau dos Plátanos - fondue", "Chateau dos Plátanos", "fondue"],
      ["Dilsinho - Oktober", "Dilsinho", "Oktober"],
      ["Caminho das Pipas - Cascata das 3 quedas", "Caminho das Pipas", "Cascata das 3 quedas"],
    ]) {
      expect(proposeCity(item(title))).toMatchObject({
        titulo_proposto: place,
        cidade_proposta: right,
        cidade_por_extenso_sugerida: "",
        acao: "revisar",
      });
    }
  });

  it("manter: sem separador, título igual e cidade vazia", () => {
    expect(proposeCity(item("Loucura Sushi"))).toMatchObject({
      titulo_proposto: "Loucura Sushi",
      cidade_proposta: "",
      cidade_por_extenso_sugerida: "",
      acao: "manter",
      motivo: "sem separador",
    });
  });

  it("manter com dica quando a cidade está colada no fim, sem separador", () => {
    const row = proposeCity(item("Formaggio NH"));
    expect(row.acao).toBe("manter");
    expect(row.cidade_proposta).toBe("");
    expect(row.motivo).toContain("“NH”");
  });
});

describe("backupItems", () => {
  it("lê { items: [{ id, title, status }] }", () => {
    expect(backupItems({ items: [{ id: "a", title: "X", status: "done", extra: 1 }] })).toEqual([
      { id: "a", title: "X", status: "done" },
    ]);
  });

  it("recusa JSON sem items ou item sem id/title", () => {
    expect(() => backupItems({})).toThrow("items");
    expect(() => backupItems({ items: [{ id: "a" }] })).toThrow("Item 1");
  });
});

describe("toCsv", () => {
  it("BOM, cabeçalho, CRLF e aspas quando precisa", () => {
    const csv = toCsv([proposeCity({ id: "a", status: "want", title: 'Olhar "dazed, confused" - Gramado' })]);
    expect(csv.startsWith("﻿id,status,titulo_atual,titulo_proposto,cidade_proposta,cidade_por_extenso_sugerida,acao,motivo\r\n")).toBe(true);
    expect(csv).toContain('a,want,"Olhar ""dazed, confused"" - Gramado","Olhar ""dazed, confused""",Gramado,Gramado,separar,');
    expect(csv.endsWith("\r\n")).toBe(true);
    expect(CSV_COLUMNS).toHaveLength(8);
  });
});

describe("summarize", () => {
  it("conta separar/revisar/manter", () => {
    const rows = ["A - Gramado", "B - fondue", "C"].map((title) => proposeCity(item(title)));
    expect(summarize(rows)).toEqual({ total: 3, separar: 1, revisar: 1, manter: 1 });
  });
});

describe("scripts/cidades-trello-previa.mjs", () => {
  it("lê o JSON, escreve uma linha por item e não mexe na entrada", () => {
    const dir = mkdtempSync(join(tmpdir(), "juntos-cidades-"));
    try {
      const entrada = join(dir, "backup.json");
      const saida = join(dir, "sub", "previa.csv");
      const json = JSON.stringify({
        items: [
          { id: "1", status: "want", title: "Adoma - Ivoti" },
          { id: "2", status: "done", title: "Dilsinho - Oktober" },
          { id: "3", status: "done", title: "Cantina" },
        ],
      });
      writeFileSync(entrada, json);
      const out = execFileSync("node", ["scripts/cidades-trello-previa.mjs", "--entrada", entrada, "--saida", saida], {
        encoding: "utf8",
      });
      expect(out).toContain("separar: 1");
      expect(out).toContain("revisar: 1");
      expect(out).toContain("manter:  1");
      const lines = readFileSync(saida, "utf8").trimEnd().split("\r\n");
      expect(lines).toHaveLength(4);
      expect(readFileSync(entrada, "utf8")).toBe(json);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("sem --saida, ou saída igual à entrada: erro e nada escrito", () => {
    expect(() =>
      execFileSync("node", ["scripts/cidades-trello-previa.mjs", "--entrada", "x.json"], { stdio: "pipe" }),
    ).toThrow();
    expect(() =>
      execFileSync("node", ["scripts/cidades-trello-previa.mjs", "--entrada", "x.json", "--saida", "x.json"], {
        stdio: "pipe",
      }),
    ).toThrow();
  });
});
