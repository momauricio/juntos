import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { savedToastCopy } from "@/lib/capture-link";
import {
  ACTIVITY_NO_ADDRESS_COPY,
  NOTES_PLACEHOLDER,
  STATUS_LABELS,
  TYPE_CHIP_LABELS,
  TYPE_EMOJI,
  TYPE_HINTS,
  TYPE_LABELS,
  TYPE_THUMB,
  typeEmoji,
  typeHint,
  typeLabel,
} from "@/lib/labels";

const TYPE_KEYS = [
  "activity",
  "restaurant",
  "food_idea",
  "tourist_spot",
  "movie",
  "city",
  "stay",
  "event",
];

describe("STATUS_LABELS", () => {
  it("labels want as Queremos and done as Já fizemos", () => {
    expect(STATUS_LABELS).toEqual({
      all: "Todos",
      want: "Queremos",
      done: "Já fizemos",
    });
  });

  it("names the toast after saving", () => {
    expect(savedToastCopy("want")).toBe("Salvo em Queremos 💛");
  });
});

describe("type maps", () => {
  it("have the same 8 keys, Programa first, Hospedagem after Cidade", () => {
    for (const map of [
      TYPE_LABELS,
      TYPE_EMOJI,
      TYPE_HINTS,
      TYPE_CHIP_LABELS,
      TYPE_THUMB,
    ]) {
      expect(Object.keys(map)).toEqual(TYPE_KEYS);
    }
  });

  it("describe Programa like the spec", () => {
    expect(TYPE_LABELS.activity).toBe("Programa");
    expect(TYPE_EMOJI.activity).toBe("🧺");
    expect(TYPE_HINTS.activity).toBe(
      "Algo pra fazer juntos: trilha, aula, piquenique.",
    );
    expect(TYPE_CHIP_LABELS.activity).toBe("Programa");
    expect(TYPE_THUMB.activity).toBe("ph5");
  });

  it("gives Evento a hint that does not compete with Programa", () => {
    expect(TYPE_HINTS.event).toBe("Show, festa, exposição: tem data marcada.");
  });

  it("describes Hospedagem", () => {
    expect(TYPE_LABELS.stay).toBe("Hospedagem");
    expect(TYPE_EMOJI.stay).toBe("🏨");
    expect(TYPE_CHIP_LABELS.stay).toBe("Hospedagem");
    expect(TYPE_HINTS.stay).toBe("Hotel, pousada ou cabana pra dormir fora.");
    expect(TYPE_THUMB.stay).toBe(TYPE_THUMB.city);
  });

  it("uses one thumbnail per type (Hospedagem shares Cidade's)", () => {
    const others = Object.entries(TYPE_THUMB).filter(([type]) => type !== "stay");
    expect(new Set(others.map(([, thumb]) => thumb)).size).toBe(TYPE_KEYS.length - 1);
  });
});

describe("unknown type fallback", () => {
  it("keeps known types as they are", () => {
    expect(typeLabel("stay")).toBe("Hospedagem");
    expect(typeEmoji("activity")).toBe("🧺");
    expect(typeHint("event")).toBe(TYPE_HINTS.event);
  });

  it("never shows undefined for a type the app does not know", () => {
    for (const type of ["boat", "", "toString", "__proto__"]) {
      expect(typeLabel(type)).toBe("Item");
      expect(typeEmoji(type)).toBe("📍");
      expect(typeHint(type)).toBe("");
    }
  });
});

describe("copy", () => {
  it("suggests where and when in the notes", () => {
    expect(NOTES_PLACEHOLDER).toBe(
      "Onde? Quando? Ex.: no ateliê do bairro, num sábado de manhã",
    );
    expect(ACTIVITY_NO_ADDRESS_COPY).toBe(
      "Programa não precisa de endereço: onde e quando, se quiserem, vão nas notas.",
    );
  });
});

function sourceFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) return sourceFiles(path);
    return /\.(ts|tsx|js|jsx|css)$/.test(name) ? [path] : [];
  });
}

// Montado em partes para este arquivo também não conter o texto antigo.
const OLD_WANT_LABEL = ["Quero", "ir"].join(" ");

describe("status copy lives in lib/labels.ts", () => {
  it("has no hardcoded old want label in app/, components/ or lib/", () => {
    const offenders = ["app", "components", "lib"]
      .flatMap((dir) => sourceFiles(join(process.cwd(), dir)))
      .filter((path) => readFileSync(path, "utf8").includes(OLD_WANT_LABEL));
    expect(offenders).toEqual([]);
  });
});
