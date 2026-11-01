import { describe, expect, it } from "vitest";

import {
  CATEGORY_DELETE_COPY,
  CATEGORY_MENU_COPY,
  CATEGORY_MESSAGES,
  CATEGORY_SHEET_COPY,
  CATEGORY_UNKNOWN_ERROR,
  EMOJI_SUGGESTIONS,
  ITEM_CATEGORY_LABEL,
  PICK_CATEGORY_COPY,
  categoryMoveOptions,
  categorySaveErrorMessage,
  deleteCountChips,
  deleteDecision,
  findCategory,
  isMenuKey,
  isSingleEmoji,
  moveCategory,
  moveCategoryTo,
  newItemCategoryFields,
  nextCategoryPosition,
  parseCategoryField,
  sameOrder,
  seeItemsStatus,
} from "@/lib/categories";

const IDS = ["hosp", "rest", "pass", "prog"];

describe("microcopy das telas 54, 55, 55b e 55c", () => {
  it("usa os textos exatos da spec", () => {
    expect(CATEGORY_SHEET_COPY.createTitle).toBe("Nova categoria");
    expect(CATEGORY_SHEET_COPY.editTitle).toBe("Editar categoria");
    expect(CATEGORY_SHEET_COPY.subtitle).toBe("Aparece pra vocês dois na hora.");
    expect(CATEGORY_SHEET_COPY.namePlaceholder).toBe("Ex.: Pubs");
    expect(CATEGORY_SHEET_COPY.otherEmoji).toBe("outro…");
    expect(CATEGORY_SHEET_COPY.previewEmpty).toBe("ainda vazia");
    expect(CATEGORY_SHEET_COPY.previewHint).toBe(
      "Assim ela fica no início de vocês, depois das outras. Dá pra mudar tudo depois.",
    );
    expect(CATEGORY_SHEET_COPY.create).toBe("Criar categoria");
    expect(CATEGORY_SHEET_COPY.save).toBe("Salvar");
    expect(CATEGORY_SHEET_COPY.created).toBe("Categoria criada");
    expect(CATEGORY_SHEET_COPY.saved).toBe("Categoria salva");
    expect(CATEGORY_SHEET_COPY.deleted).toBe("Categoria apagada");
    expect(EMOJI_SUGGESTIONS).toHaveLength(6);
    expect(EMOJI_SUGGESTIONS.every((emoji) => isSingleEmoji(emoji))).toBe(true);

    expect(
      [
        CATEGORY_MENU_COPY.rename,
        CATEGORY_MENU_COPY.restyle,
        CATEGORY_MENU_COPY.reorder,
        CATEGORY_MENU_COPY.remove,
      ].map((entry) => `${entry.emoji} ${entry.label}`),
    ).toEqual([
      "✏️ Renomear",
      "🎨 Trocar emoji e cor",
      "↕️ Mudar ordem",
      "🗑️ Apagar categoria",
    ]);
    expect(CATEGORY_MENU_COPY.footer).toBe("Vale para vocês dois.");
    expect(CATEGORY_MENU_COPY.options).toBe("Opções da categoria");
    expect(CATEGORY_MENU_COPY.reorderBar).toBe("Arraste para mudar a ordem");
    expect(CATEGORY_MENU_COPY.reorderDone).toBe("Pronto");
    expect(CATEGORY_MENU_COPY.moveUp).toBe("Mover para cima");
    expect(CATEGORY_MENU_COPY.moveDown).toBe("Mover para baixo");

    expect(CATEGORY_DELETE_COPY.blockedText).toBe(
      "Pra apagar, mova os itens pra outra categoria antes. Assim nada se perde.",
    );
    expect(CATEGORY_DELETE_COPY.seeItems).toBe("Ver os itens");
    expect(CATEGORY_DELETE_COPY.understood).toBe("Entendi");
    expect(CATEGORY_DELETE_COPY.confirmTitle("Pubs")).toBe("Apagar “Pubs”?");
    expect(CATEGORY_DELETE_COPY.confirmText).toBe("Ela está vazia. Some pra vocês dois.");
    expect(CATEGORY_DELETE_COPY.confirm).toBe("Apagar");
    expect(CATEGORY_DELETE_COPY.cancel).toBe("Cancelar");
  });

  it("nenhum texto diz Configurações", () => {
    const all = JSON.stringify([CATEGORY_SHEET_COPY, CATEGORY_MENU_COPY]);
    expect(all).not.toContain("Configurações");
  });
});

describe("apagar categoria (C1): 55b × 55c", () => {
  it("com item em qualquer aba é 55b; vazia é 55c", () => {
    expect(deleteDecision({ want: 5, done: 3 })).toBe("blocked");
    expect(deleteDecision({ want: 0, done: 1 })).toBe("blocked");
    expect(deleteDecision({ want: 1, done: 0 })).toBe("blocked");
    expect(deleteDecision({ want: 0, done: 0 })).toBe("empty");
  });

  it('título: "1 item" e "n itens"', () => {
    expect(CATEGORY_DELETE_COPY.blockedTitle("Hospedagem", 8)).toBe(
      "Hospedagem ainda tem 8 itens",
    );
    expect(CATEGORY_DELETE_COPY.blockedTitle("Pubs", 1)).toBe("Pubs ainda tem 1 item");
    expect(CATEGORY_DELETE_COPY.blockedTitle("Pubs", 2)).toBe("Pubs ainda tem 2 itens");
  });

  it("chips só com os maiores que 0", () => {
    expect(deleteCountChips({ want: 5, done: 3 })).toEqual([
      "💛 5 em Queremos",
      "✓ 3 em Já fizemos",
    ]);
    expect(deleteCountChips({ want: 0, done: 3 })).toEqual(["✓ 3 em Já fizemos"]);
    expect(deleteCountChips({ want: 2, done: 0 })).toEqual(["💛 2 em Queremos"]);
    expect(deleteCountChips({ want: 0, done: 0 })).toEqual([]);
  });

  it('"Ver os itens" abre a aba que tem itens, Queremos primeiro', () => {
    expect(seeItemsStatus({ want: 5, done: 3 })).toBe("want");
    expect(seeItemsStatus({ want: 1, done: 0 })).toBe("want");
    expect(seeItemsStatus({ want: 0, done: 3 })).toBe("done");
    expect(seeItemsStatus({ want: 0, done: 0 })).toBe("want");
  });
});

describe("ordem das categorias", () => {
  it("categoria nova fica com position = maior + 1 (C4)", () => {
    expect(nextCategoryPosition([{ position: 1 }, { position: 8 }, { position: 3 }])).toBe(9);
    expect(nextCategoryPosition([])).toBe(1);
    // Buracos na ordem (uma apagada no meio) não importam: sempre depois da última.
    expect(nextCategoryPosition([{ position: 2 }, { position: 5 }])).toBe(6);
  });

  it("Mover para cima/baixo troca com a vizinha", () => {
    expect(moveCategory(IDS, "pass", "up")).toEqual(["hosp", "pass", "rest", "prog"]);
    expect(moveCategory(IDS, "rest", "down")).toEqual(["hosp", "pass", "rest", "prog"]);
  });

  it("na ponta, não muda nada", () => {
    expect(moveCategory(IDS, "hosp", "up")).toEqual(IDS);
    expect(moveCategory(IDS, "prog", "down")).toEqual(IDS);
    expect(moveCategory(IDS, "nao-existe", "up")).toEqual(IDS);
  });

  it("arrastar leva para qualquer posição", () => {
    expect(moveCategoryTo(IDS, "prog", 0)).toEqual(["prog", "hosp", "rest", "pass"]);
    expect(moveCategoryTo(IDS, "hosp", 3)).toEqual(["rest", "pass", "prog", "hosp"]);
    expect(moveCategoryTo(IDS, "hosp", 99)).toEqual(["rest", "pass", "prog", "hosp"]);
    expect(moveCategoryTo(IDS, "rest", -4)).toEqual(["rest", "hosp", "pass", "prog"]);
    expect(moveCategoryTo(IDS, "rest", 1)).toEqual(IDS);
  });

  it("não mexe no array original", () => {
    const ids = [...IDS];
    moveCategory(ids, "pass", "up");
    moveCategoryTo(ids, "pass", 0);
    expect(ids).toEqual(IDS);
  });

  it("as setas do menu somem nas pontas", () => {
    expect(categoryMoveOptions(IDS, "hosp")).toEqual({ up: false, down: true });
    expect(categoryMoveOptions(IDS, "rest")).toEqual({ up: true, down: true });
    expect(categoryMoveOptions(IDS, "prog")).toEqual({ up: true, down: false });
    expect(categoryMoveOptions(["so"], "so")).toEqual({ up: false, down: false });
    expect(categoryMoveOptions(IDS, "nao-existe")).toEqual({ up: false, down: false });
  });

  it("sameOrder compara a ordem", () => {
    expect(sameOrder(IDS, [...IDS])).toBe(true);
    expect(sameOrder(IDS, moveCategory(IDS, "pass", "up"))).toBe(false);
    expect(sameOrder(IDS, IDS.slice(0, 3))).toBe(false);
  });
});

describe("abrir o menu pelo teclado", () => {
  it("tecla de menu ou Shift+F10", () => {
    expect(isMenuKey({ key: "ContextMenu", shiftKey: false })).toBe(true);
    expect(isMenuKey({ key: "F10", shiftKey: true })).toBe(true);
    expect(isMenuKey({ key: "F10", shiftKey: false })).toBe(false);
    expect(isMenuKey({ key: "Enter", shiftKey: true })).toBe(false);
  });
});

describe("erro do banco ao salvar categoria → texto da folha 54", () => {
  const existing = [
    { id: "a", name: "Pubs" },
    { id: "b", name: "Hospedagem" },
  ];
  const input = { name: " púbs ", emoji: "🍺", color: "ph5" as const };

  it("nome repetido mostra o nome que já existe", () => {
    expect(categorySaveErrorMessage("duplicate_name", input, existing)).toBe(
      "Vocês já têm uma categoria “Pubs”.",
    );
  });

  it("nome repetido sem achar a outra (lista velha) usa o nome digitado", () => {
    expect(categorySaveErrorMessage("duplicate_name", input, [])).toBe(
      "Vocês já têm uma categoria “púbs”.",
    );
  });

  it("ao editar, a própria categoria não conta", () => {
    expect(categorySaveErrorMessage("duplicate_name", input, existing, "a")).toBe(
      "Vocês já têm uma categoria “púbs”.",
    );
  });

  it("limite e erro desconhecido", () => {
    expect(categorySaveErrorMessage("limit", input, existing)).toBe(CATEGORY_MESSAGES.limit);
    expect(categorySaveErrorMessage("unknown", input, existing)).toBe(CATEGORY_UNKNOWN_ERROR);
    expect(categorySaveErrorMessage("not_found", input, existing)).toBe(CATEGORY_UNKNOWN_ERROR);
  });
});

describe('campo "Categoria" no salvar/editar item', () => {
  const UUID = "3f2b8f8e-6a1c-4f7e-9d7a-2b9c1e0a5d11";
  const categories = [
    { id: UUID, item_type: "activity" as const, name: "Pubs" },
    { id: "b6f1c1e2-1111-4f7e-9d7a-2b9c1e0a5d11", item_type: "stay" as const, name: "Hospedagem" },
  ];

  it('rótulo "Categoria" e aviso sem categoria', () => {
    expect(ITEM_CATEGORY_LABEL).toBe("Categoria");
    expect(PICK_CATEGORY_COPY).toBe("Escolhe uma categoria pra salvar.");
  });

  it("aceita só um uuid", () => {
    expect(parseCategoryField(UUID)).toBe(UUID);
    expect(parseCategoryField(`  ${UUID} `)).toBe(UUID);
    expect(parseCategoryField("")).toBeNull();
    expect(parseCategoryField(null)).toBeNull();
    expect(parseCategoryField(undefined)).toBeNull();
    expect(parseCategoryField("restaurant")).toBeNull();
    expect(parseCategoryField(`${UUID}' or 1=1`)).toBeNull();
  });

  it("acha só categoria do espaço", () => {
    expect(findCategory(categories, UUID)?.name).toBe("Pubs");
    expect(findCategory(categories, "4c1d2e3f-0000-4f7e-9d7a-2b9c1e0a5d11")).toBeNull();
    expect(findCategory(categories, null)).toBeNull();
  });

  it("item novo: type sai de category.item_type", () => {
    expect(newItemCategoryFields(categories[0])).toEqual({
      category_id: UUID,
      type: "activity",
    });
    expect(newItemCategoryFields(categories[1]).type).toBe("stay");
  });
});
