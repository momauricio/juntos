import { describe, expect, it } from "vitest";

import { EDIT_CONFLICT_PARAM, editConflictMessage, editConflictWith, isUuid } from "@/lib/edit-conflict";

const EU = "00000000-0000-4000-8000-0000000000a1";
const PAR = "00000000-0000-4000-8000-0000000000a2";
const LOADED = "2026-10-31T14:00:00.123456+00:00";

describe("editConflictMessage", () => {
  it("é o texto exato", () => {
    expect(editConflictMessage("Bia")).toBe("Bia também mexeu aqui. Mantivemos a sua versão.");
    expect(EDIT_CONFLICT_PARAM).toBe("mexeu");
  });
});

describe("editConflictWith", () => {
  it("ninguém mexeu depois: sem conflito", () => {
    expect(editConflictWith({ loadedUpdatedAt: LOADED, current: { updated_at: LOADED, updated_by: PAR }, userId: EU })).toBeNull();
  });

  it("o par gravou depois que a tela carregou: devolve o id do par", () => {
    expect(
      editConflictWith({
        loadedUpdatedAt: LOADED,
        current: { updated_at: "2026-10-31T14:02:00.5+00:00", updated_by: PAR },
        userId: EU,
      }),
    ).toBe(PAR);
  });

  it("diferença só nos microssegundos ainda é outra versão", () => {
    expect(
      editConflictWith({
        loadedUpdatedAt: LOADED,
        current: { updated_at: "2026-10-31T14:00:00.123457+00:00", updated_by: PAR },
        userId: EU,
      }),
    ).toBe(PAR);
  });

  it("mesmo instante escrito de outro jeito não é conflito", () => {
    expect(
      editConflictWith({
        loadedUpdatedAt: "2026-10-31T14:00:00.1+00:00",
        current: { updated_at: "2026-10-31T11:00:00.100000-03:00", updated_by: PAR },
        userId: EU,
      }),
    ).toBeNull();
  });

  it("a última gravação foi minha (outra aba): sem aviso", () => {
    expect(
      editConflictWith({ loadedUpdatedAt: LOADED, current: { updated_at: "2026-10-31T15:00:00+00:00", updated_by: EU }, userId: EU }),
    ).toBeNull();
  });

  it("sem updated_at carregado ou sem updated_by: não dá para afirmar, sem aviso", () => {
    const current = { updated_at: "2026-10-31T15:00:00+00:00", updated_by: PAR };
    expect(editConflictWith({ loadedUpdatedAt: "", current, userId: EU })).toBeNull();
    expect(editConflictWith({ loadedUpdatedAt: null, current, userId: EU })).toBeNull();
    expect(editConflictWith({ loadedUpdatedAt: LOADED, current: { ...current, updated_by: null }, userId: EU })).toBeNull();
  });

  it("updated_at carregado ilegível: sem aviso (grava do mesmo jeito)", () => {
    expect(
      editConflictWith({ loadedUpdatedAt: "ontem", current: { updated_at: LOADED, updated_by: PAR }, userId: EU }),
    ).toBeNull();
  });
});

describe("isUuid", () => {
  it("só aceita uuid (o parâmetro da URL vai para uma consulta)", () => {
    expect(isUuid(PAR)).toBe(true);
    expect(isUuid(PAR.toUpperCase())).toBe(true);
    expect(isUuid("abc")).toBe(false);
    expect(isUuid(`${PAR},x`)).toBe(false);
    expect(isUuid(undefined)).toBe(false);
    expect(isUuid([PAR])).toBe(false);
  });
});
