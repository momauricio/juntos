import { describe, expect, it } from "vitest";

import {
  isSearchActive,
  normalizeSearchText,
  searchItems,
  SEARCH_MIN_LENGTH,
} from "@/lib/item-search";

type Row = { id: string; title: string; city: string | null; notes: string | null };

const row = (id: string, title: string, city: string | null = null, notes: string | null = null): Row => ({
  id,
  title,
  city,
  notes,
});

const ids = (rows: Row[]) => rows.map((r) => r.id);

describe("normalizeSearchText", () => {
  it("ignora acento, maiúscula e espaços extras", () => {
    expect(normalizeSearchText("  Café   GRAMADO ")).toBe("cafe gramado");
    expect(normalizeSearchText("São Chico")).toBe("sao chico");
    expect(normalizeSearchText("Portão")).toBe("portao");
    expect(normalizeSearchText("Açaí")).toBe("acai");
  });

  it("null/undefined viram texto vazio", () => {
    expect(normalizeSearchText(null)).toBe("");
    expect(normalizeSearchText(undefined)).toBe("");
  });
});

describe("isSearchActive", () => {
  it("começa no 2º caractere útil", () => {
    expect(SEARCH_MIN_LENGTH).toBe(2);
    expect(isSearchActive("")).toBe(false);
    expect(isSearchActive("g")).toBe(false);
    expect(isSearchActive("  g  ")).toBe(false);
    expect(isSearchActive("gr")).toBe(true);
    expect(isSearchActive(" é ")).toBe(false);
  });
});

describe("searchItems", () => {
  const items = [
    row("notas", "Fondue", null, "Fica em Gramado, perto do lago"),
    row("cidade", "Montt Sierra Cabanas", "Gramado"),
    row("titulo", "Gramado Palace"),
    row("nada", "Cantina", "Igrejinha", "massa boa"),
    row("titulo2", "Café em gramado", "Canela", "gramado de novo"),
  ];

  it("título primeiro, depois só cidade, depois só notas (ordem de entrada em cada grupo)", () => {
    expect(ids(searchItems(items, "gramado"))).toEqual(["titulo", "titulo2", "cidade", "notas"]);
  });

  it("sem diferenciar acento e maiúscula, nos dois sentidos", () => {
    const list = [row("a", "Pão de Queijo"), row("b", "Padaria", "São Leopoldo"), row("c", "Lanche", null, "PERTO DO PORTÃO")];
    expect(ids(searchItems(list, "PAO"))).toEqual(["a"]);
    expect(ids(searchItems(list, "são leo"))).toEqual(["b"]);
    expect(ids(searchItems(list, "portao"))).toEqual(["c"]);
  });

  it("espaços extras na busca não atrapalham", () => {
    expect(ids(searchItems(items, "  gramado   palace "))).toEqual(["titulo"]);
  });

  it("0–1 caractere: sem busca, lista vazia", () => {
    expect(searchItems(items, "")).toEqual([]);
    expect(searchItems(items, "g")).toEqual([]);
    expect(searchItems(items, "   ")).toEqual([]);
  });

  it("sem resultado: lista vazia", () => {
    expect(searchItems(items, "torres")).toEqual([]);
  });

  it("cidade e notas nulas não quebram", () => {
    expect(ids(searchItems([row("x", "Cinema")], "cine"))).toEqual(["x"]);
  });

  it("devolve os próprios objetos, sem copiar", () => {
    expect(searchItems(items, "palace")[0]).toBe(items[2]);
  });
});
