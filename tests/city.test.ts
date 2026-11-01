import { describe, expect, it } from "vitest";

import { CITY_MAX_LENGTH, normalizeCity } from "@/lib/city";

describe("normalizeCity", () => {
  it("faz trim", () => {
    expect(normalizeCity("  Gramado ")).toEqual({ ok: true, city: "Gramado" });
    expect(normalizeCity("\tNovo Hamburgo\n")).toEqual({ ok: true, city: "Novo Hamburgo" });
  });

  it("vazio, só espaço ou campo ausente viram null", () => {
    expect(normalizeCity("")).toEqual({ ok: true, city: null });
    expect(normalizeCity("   ")).toEqual({ ok: true, city: null });
    expect(normalizeCity(null)).toEqual({ ok: true, city: null });
    expect(normalizeCity(undefined)).toEqual({ ok: true, city: null });
  });

  it("aceita até 60 caracteres depois do trim, contando acento como 1", () => {
    expect(CITY_MAX_LENGTH).toBe(60);
    expect(normalizeCity("a".repeat(60))).toEqual({ ok: true, city: "a".repeat(60) });
    expect(normalizeCity(`  ${"ã".repeat(60)}  `)).toEqual({ ok: true, city: "ã".repeat(60) });
    // Emoji conta 1 (como o char_length do banco), não 2.
    expect(normalizeCity("🏖".repeat(60))).toEqual({ ok: true, city: "🏖".repeat(60) });
  });

  it("recusa mais de 60 depois do trim", () => {
    expect(normalizeCity("a".repeat(61))).toEqual({ ok: false });
  });

  it("mantém o texto como a pessoa escreveu (maiúscula, acento, espaços do meio)", () => {
    expect(normalizeCity("são  chico")).toEqual({ ok: true, city: "são  chico" });
  });

  it("recusa o que não é texto (arquivo no FormData)", () => {
    expect(normalizeCity(new Blob(["x"]))).toEqual({ ok: false });
  });
});
