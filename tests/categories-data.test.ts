import type { SupabaseClient } from "@supabase/supabase-js";
import { describe, expect, it } from "vitest";

import {
  countCategoryItems,
  createCategory,
  deleteCategory,
  listCategories,
  moveCategories,
  setItemView,
  updateCategory,
} from "@/lib/categories-data";

type Response = {
  data?: unknown;
  error?: { message: string; code?: string } | null;
  count?: number | null;
};

type Call = { table: string; steps: [string, ...unknown[]][] };

// Cliente fake: grava a cadeia de chamadas de cada from() e devolve as
// respostas na ordem (uma por query).
function fakeClient(responses: Response[]) {
  const calls: Call[] = [];
  let next = 0;

  const client = {
    from(table: string) {
      const call: Call = { table, steps: [] };
      calls.push(call);
      const response = responses[next++] ?? {};
      const result = {
        data: response.data ?? null,
        error: response.error ?? null,
        count: response.count ?? null,
      };
      const builder: Record<string, unknown> = {};
      for (const method of [
        "select", "insert", "update", "delete", "eq", "order", "single", "maybeSingle",
      ]) {
        builder[method] = (...args: unknown[]) => {
          call.steps.push([method, ...args]);
          return builder;
        };
      }
      builder.then = (resolve: (value: unknown) => unknown, reject: (e: unknown) => unknown) =>
        Promise.resolve(result).then(resolve, reject);
      return builder;
    },
  };

  return { supabase: client as unknown as SupabaseClient, calls };
}

const category = {
  id: "cat-1",
  space_id: "space-1",
  name: "Pubs",
  name_key: "pubs",
  emoji: "🍺",
  color: "ph5",
  position: 9,
  item_type: "activity",
  created_by: "user-1",
  created_at: "2026-10-31T12:00:00Z",
  updated_at: "2026-10-31T12:00:00Z",
};

describe("listCategories", () => {
  it("lê as categorias do espaço na ordem position, created_at", async () => {
    const { supabase, calls } = fakeClient([{ data: [category] }]);
    expect(await listCategories(supabase, "space-1")).toEqual({ ok: true, categories: [category] });
    expect(calls[0]).toEqual({
      table: "categories",
      steps: [
        ["select", "*"],
        ["eq", "space_id", "space-1"],
        ["order", "position", { ascending: true }],
        ["order", "created_at", { ascending: true }],
      ],
    });
  });

  it("erro vira ok: false", async () => {
    const { supabase } = fakeClient([{ error: { message: "boom" } }]);
    expect(await listCategories(supabase, "space-1")).toEqual({ ok: false, reason: "unknown" });
  });
});

describe("createCategory", () => {
  it("insere com item_type activity, nome com trim e sem position", async () => {
    const { supabase, calls } = fakeClient([{ data: category }]);
    const result = await createCategory(supabase, "space-1", {
      name: "  Pubs ",
      emoji: "🍺",
      color: "ph5",
    });
    expect(result).toEqual({ ok: true, category });
    expect(calls[0].steps[0]).toEqual([
      "insert",
      { space_id: "space-1", name: "Pubs", emoji: "🍺", color: "ph5", item_type: "activity" },
    ]);
    expect(calls[0].steps).toContainEqual(["single"]);
  });

  it("nome repetido e limite viram reason", async () => {
    const duplicate = fakeClient([
      {
        error: {
          code: "23505",
          message: 'duplicate key value violates unique constraint "categories_space_name_key_unique"',
        },
      },
    ]);
    expect(
      await createCategory(duplicate.supabase, "space-1", { name: "púbs", emoji: "🍺", color: "ph5" }),
    ).toEqual({ ok: false, reason: "duplicate_name" });

    const limit = fakeClient([{ error: { code: "23514", message: "category_limit" } }]);
    expect(
      await createCategory(limit.supabase, "space-1", { name: "X", emoji: "🍺", color: "ph5" }),
    ).toEqual({ ok: false, reason: "limit" });
  });
});

describe("updateCategory", () => {
  it("manda só os campos informados", async () => {
    const { supabase, calls } = fakeClient([{ data: { ...category, name: "Bares" } }]);
    const result = await updateCategory(supabase, "cat-1", { name: " Bares " });
    expect(result).toEqual({ ok: true, category: { ...category, name: "Bares" } });
    expect(calls[0].steps).toEqual([
      ["update", { name: "Bares" }],
      ["eq", "id", "cat-1"],
      ["select", "*"],
      ["maybeSingle"],
    ]);
  });

  it("sem linha (RLS/apagada) vira not_found", async () => {
    const { supabase } = fakeClient([{ data: null }]);
    expect(await updateCategory(supabase, "cat-x", { color: "ph1" })).toEqual({
      ok: false,
      reason: "not_found",
    });
  });
});

describe("moveCategories", () => {
  it("grava position 1..n na ordem recebida", async () => {
    const { supabase, calls } = fakeClient([
      { data: [{ id: "c" }] },
      { data: [{ id: "a" }] },
      { data: [{ id: "b" }] },
    ]);
    expect(await moveCategories(supabase, ["c", "a", "b"])).toEqual({ ok: true });
    expect(calls.map((call) => [call.steps[0], call.steps[1]])).toEqual([
      [["update", { position: 1 }], ["eq", "id", "c"]],
      [["update", { position: 2 }], ["eq", "id", "a"]],
      [["update", { position: 3 }], ["eq", "id", "b"]],
    ]);
  });

  it("para no primeiro erro", async () => {
    const { supabase, calls } = fakeClient([
      { data: [{ id: "c" }] },
      { error: { message: "boom" } },
    ]);
    expect(await moveCategories(supabase, ["c", "a", "b"])).toEqual({ ok: false, reason: "unknown" });
    expect(calls).toHaveLength(2);
  });
});

describe("deleteCategory", () => {
  it("apaga a vazia", async () => {
    const { supabase, calls } = fakeClient([{ data: [{ id: "cat-1" }] }]);
    expect(await deleteCategory(supabase, "cat-1")).toEqual({ ok: true });
    expect(calls[0].steps).toEqual([["delete"], ["eq", "id", "cat-1"], ["select", "id"]]);
  });

  it("com itens: not_empty", async () => {
    const { supabase } = fakeClient([{ error: { code: "23503", message: "category_not_empty" } }]);
    expect(await deleteCategory(supabase, "cat-1")).toEqual({ ok: false, reason: "not_empty" });
  });

  it("nada apagado (RLS): not_found", async () => {
    const { supabase } = fakeClient([{ data: [] }]);
    expect(await deleteCategory(supabase, "cat-1")).toEqual({ ok: false, reason: "not_found" });
  });
});

describe("countCategoryItems", () => {
  it("conta Queremos e Já fizemos com head count", async () => {
    const { supabase, calls } = fakeClient([{ count: 5 }, { count: 3 }]);
    expect(await countCategoryItems(supabase, "cat-stay")).toEqual({ ok: true, want: 5, done: 3 });
    expect(calls[0]).toEqual({
      table: "items",
      steps: [
        ["select", "id", { count: "exact", head: true }],
        ["eq", "category_id", "cat-stay"],
        ["eq", "status", "want"],
      ],
    });
    expect(calls[1].steps[2]).toEqual(["eq", "status", "done"]);
  });

  it("erro em qualquer contagem vira ok: false", async () => {
    const { supabase } = fakeClient([{ count: 5 }, { error: { message: "boom" } }]);
    expect(await countCategoryItems(supabase, "cat-stay")).toEqual({ ok: false, reason: "unknown" });
  });
});

describe("setItemView", () => {
  it("grava profiles.item_view da pessoa", async () => {
    const { supabase, calls } = fakeClient([{ data: [{ id: "user-1" }] }]);
    expect(await setItemView(supabase, "user-1", "compact")).toEqual({ ok: true });
    expect(calls[0]).toEqual({
      table: "profiles",
      steps: [["update", { item_view: "compact" }], ["eq", "id", "user-1"], ["select", "id"]],
    });
  });

  it("sem linha atualizada: not_found", async () => {
    const { supabase } = fakeClient([{ data: [] }]);
    expect(await setItemView(supabase, "user-2", "grid")).toEqual({ ok: false, reason: "not_found" });
  });
});
