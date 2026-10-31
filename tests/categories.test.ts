import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import {
  CATEGORY_COLORS,
  CATEGORY_LIMIT,
  CATEGORY_NAME_MAX,
  CUSTOM_CATEGORY_ITEM_TYPE,
  DEFAULT_CATEGORIES,
  categoryErrorCode,
  categoryNameKey,
  isSingleEmoji,
  sortCategories,
  validateCategoryInput,
} from "@/lib/categories";
import { TYPE_CHIP_LABELS, TYPE_EMOJI } from "@/lib/labels";
import type { ItemType } from "@/lib/types";

const pubs = { id: "c-pubs", name: "Pubs" };
const hospedagem = { id: "c-stay", name: "Hospedagem" };

function existing(n: number) {
  return Array.from({ length: n }, (_, i) => ({ id: `c${i}`, name: `Categoria ${i}` }));
}

describe("constantes", () => {
  it("tem os 8 tokens da paleta P, com nome", () => {
    expect(CATEGORY_COLORS.map((c) => c.token)).toEqual([
      "ph1", "ph2", "ph3", "ph4", "ph5", "ph6", "ph7", "ph8",
    ]);
    expect(CATEGORY_COLORS.find((c) => c.token === "ph8")?.name).toBe("verde-mata");
    expect(CATEGORY_COLORS.find((c) => c.token === "ph5")?.name).toBe("lilás");
  });

  it("limites e tipo da categoria criada pelo casal", () => {
    expect(CATEGORY_LIMIT).toBe(30);
    expect(CATEGORY_NAME_MAX).toBe(24);
    expect(CUSTOM_CATEGORY_ITEM_TYPE).toBe("activity");
  });

  it("DEFAULT_CATEGORIES segue a tabela §3 (nomes dos chips, emojis de hoje)", () => {
    expect(DEFAULT_CATEGORIES.map((c) => [c.position, c.name, c.emoji, c.color, c.item_type])).toEqual([
      [1, "Hospedagem", "🏨", "ph8", "stay"],
      [2, "Restaurante", "🍝", "ph3", "restaurant"],
      [3, "Passeio", "🏖️", "ph2", "tourist_spot"],
      [4, "Programa", "🧺", "ph5", "activity"],
      [5, "Comida", "☕", "ph1", "food_idea"],
      [6, "Cidade", "🏙️", "ph4", "city"],
      [7, "Filme", "🎬", "ph6", "movie"],
      [8, "Evento", "🎟️", "ph7", "event"],
    ]);
    for (const category of DEFAULT_CATEGORIES) {
      const type = category.item_type as ItemType;
      expect(category.name).toBe(TYPE_CHIP_LABELS[type]);
      expect(category.emoji).toBe(TYPE_EMOJI[type]);
    }
  });

  it("DEFAULT_CATEGORIES é igual à semeadura da migration", () => {
    const sql = readFileSync(
      join(process.cwd(), "supabase/migrations/20261031120000_categories.sql"),
      "utf8",
    );
    for (const c of DEFAULT_CATEGORIES) {
      expect(sql).toContain(
        `(p_space_id, ${c.position}, '${c.name}', '${c.emoji}', '${c.color}', '${c.item_type}')`,
      );
    }
  });
});

describe("categoryNameKey", () => {
  it("ignora acento, maiúscula e espaços extras (C2)", () => {
    expect(categoryNameKey("Pubs")).toBe("pubs");
    expect(categoryNameKey("pubs")).toBe("pubs");
    expect(categoryNameKey(" Púbs ")).toBe("pubs");
    expect(categoryNameKey("  Cafés   da   Manhã ")).toBe("cafes da manha");
    expect(categoryNameKey("Ação")).toBe("acao");
  });
});

describe("isSingleEmoji", () => {
  it("aceita um emoji, inclusive com seletor de variação, ZWJ e bandeira", () => {
    for (const emoji of ["🍺", "🏖️", "🏙️", "👩‍❤️‍👨", "🇧🇷", "1️⃣", "☕"]) {
      expect(isSingleEmoji(emoji)).toBe(true);
    }
  });

  it("recusa vazio, dois emojis e texto", () => {
    for (const value of ["", " ", "🍺🍺", "a", "ab", "🍺a"]) {
      expect(isSingleEmoji(value)).toBe(false);
    }
  });
});

describe("validateCategoryInput", () => {
  const ok = { name: "Pubs", emoji: "🍺", color: "ph5" as const };

  it("aceita uma categoria nova válida", () => {
    expect(validateCategoryInput(ok, [hospedagem])).toBeNull();
  });

  it("nome vazio", () => {
    expect(validateCategoryInput({ ...ok, name: "   " }, [])).toBe("Dê um nome pra categoria.");
  });

  it("nome com 25 letras (24 passa)", () => {
    expect(validateCategoryInput({ ...ok, name: "a".repeat(25) }, [])).toBe("Até 24 letras.");
    expect(validateCategoryInput({ ...ok, name: ` ${"a".repeat(24)} ` }, [])).toBeNull();
  });

  it("nome repetido sem diferenciar acento/maiúscula/espaços, citando o nome existente", () => {
    expect(validateCategoryInput({ ...ok, name: " púbs " }, [pubs])).toBe(
      "Vocês já têm uma categoria “Pubs”.",
    );
  });

  it("renomear para o próprio nome mudando só maiúscula é permitido", () => {
    expect(
      validateCategoryInput({ ...ok, name: "PUBS" }, [pubs, hospedagem], { editingId: "c-pubs" }),
    ).toBeNull();
    expect(
      validateCategoryInput({ ...ok, name: "hospedagem" }, [pubs, hospedagem], { editingId: "c-pubs" }),
    ).toBe("Vocês já têm uma categoria “Hospedagem”.");
  });

  it("emoji: um só", () => {
    expect(validateCategoryInput({ ...ok, emoji: "🍺🍻" }, [])).toBe("Escolha um emoji só.");
    expect(validateCategoryInput({ ...ok, emoji: "" }, [])).toBe("Escolha um emoji só.");
  });

  it("limite de 30 ao criar; editar com 30 continua permitido", () => {
    expect(validateCategoryInput(ok, existing(29))).toBeNull();
    expect(validateCategoryInput(ok, existing(30))).toBe(
      "Vocês chegaram ao limite de 30 categorias.",
    );
    expect(validateCategoryInput(ok, existing(30), { editingId: "c0" })).toBeNull();
  });
});

describe("sortCategories", () => {
  it("ordena por position e, no empate, por created_at (C7), sem mudar a lista original", () => {
    const list = [
      { id: "b", position: 2, created_at: "2026-10-31T10:00:00Z" },
      { id: "c", position: 1, created_at: "2026-10-31T12:00:00Z" },
      { id: "a", position: 1, created_at: "2026-10-31T11:00:00Z" },
    ];
    expect(sortCategories(list).map((c) => c.id)).toEqual(["a", "c", "b"]);
    expect(list.map((c) => c.id)).toEqual(["b", "c", "a"]);
  });
});

describe("categoryErrorCode", () => {
  it("mapeia os erros do banco", () => {
    expect(categoryErrorCode({ code: "23503", message: "category_not_empty" })).toBe("not_empty");
    expect(
      categoryErrorCode({
        code: "23503",
        message:
          'update or delete on table "categories" violates foreign key constraint "items_category_id_fkey" on table "items"',
      }),
    ).toBe("not_empty");
    expect(categoryErrorCode({ code: "23514", message: "category_limit" })).toBe("limit");
    expect(
      categoryErrorCode({
        code: "23505",
        message: 'duplicate key value violates unique constraint "categories_space_name_key_unique"',
      }),
    ).toBe("duplicate_name");
    expect(categoryErrorCode({ code: "23514", message: "category_other_space" })).toBe("other_space");
  });

  it("o resto vira unknown", () => {
    expect(categoryErrorCode({ code: "23505", message: 'unique constraint "outra"' })).toBe("unknown");
    expect(categoryErrorCode({ code: "42501", message: "new row violates row-level security policy" })).toBe("unknown");
    expect(categoryErrorCode(null)).toBe("unknown");
    expect(categoryErrorCode(undefined)).toBe("unknown");
  });
});
