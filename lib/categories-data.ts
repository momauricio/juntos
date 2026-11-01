import type { SupabaseClient } from "@supabase/supabase-js";

import {
  CUSTOM_CATEGORY_ITEM_TYPE,
  categoryErrorCode,
  type CategoryErrorCode,
  type CategoryInput,
} from "@/lib/categories";
import type { Category, ItemView } from "@/lib/types";

// Camada de dados das categorias (PR 1: ainda sem tela usando).
// Recebe o cliente do Supabase de quem chama (servidor ou navegador); a RLS
// e os triggers do banco garantem as regras. Erros esperados voltam como
// { ok: false, reason }, sem throw.

// not_found: a linha não existe ou a RLS escondeu (outro espaço).
export type CategoryFailureReason = CategoryErrorCode | "not_found";

export type CategoryResult<T extends object = object> =
  | ({ ok: true } & T)
  | { ok: false; reason: CategoryFailureReason };

type DbError = { message?: string | null; code?: string | null } | null;

function failure(error: DbError): { ok: false; reason: CategoryFailureReason } {
  return { ok: false, reason: categoryErrorCode(error) };
}

const NOT_FOUND = { ok: false, reason: "not_found" } as const;

export async function listCategories(
  supabase: SupabaseClient,
  spaceId: string,
): Promise<CategoryResult<{ categories: Category[] }>> {
  const { data, error } = await supabase
    .from("categories")
    .select("*")
    .eq("space_id", spaceId)
    .order("position", { ascending: true })
    .order("created_at", { ascending: true });

  if (error) return failure(error);
  return { ok: true, categories: (data ?? []) as Category[] };
}

// position fica de fora: o trigger põe no fim da ordem (C4).
export async function createCategory(
  supabase: SupabaseClient,
  spaceId: string,
  input: CategoryInput,
): Promise<CategoryResult<{ category: Category }>> {
  const { data, error } = await supabase
    .from("categories")
    .insert({
      space_id: spaceId,
      name: input.name.trim(),
      emoji: input.emoji.trim(),
      color: input.color,
      item_type: CUSTOM_CATEGORY_ITEM_TYPE,
    })
    .select("*")
    .single();

  if (error) return failure(error);
  return { ok: true, category: data as Category };
}

export async function updateCategory(
  supabase: SupabaseClient,
  id: string,
  patch: Partial<CategoryInput>,
): Promise<CategoryResult<{ category: Category }>> {
  const changes: Partial<CategoryInput> = {};
  if (patch.name !== undefined) changes.name = patch.name.trim();
  if (patch.emoji !== undefined) changes.emoji = patch.emoji.trim();
  if (patch.color !== undefined) changes.color = patch.color;

  const { data, error } = await supabase
    .from("categories")
    .update(changes)
    .eq("id", id)
    .select("*")
    .maybeSingle();

  if (error) return failure(error);
  if (!data) return NOT_FOUND;
  return { ok: true, category: data as Category };
}

// Grava a ordem da tela: o 1º id fica com position 1, o 2º com 2...
// Um update por categoria (no máximo 30); para no primeiro erro.
export async function moveCategories(
  supabase: SupabaseClient,
  orderedIds: readonly string[],
): Promise<CategoryResult> {
  for (const [index, id] of orderedIds.entries()) {
    const { data, error } = await supabase
      .from("categories")
      .update({ position: index + 1 })
      .eq("id", id)
      .select("id");

    if (error) return failure(error);
    if (!data || data.length === 0) return NOT_FOUND;
  }
  return { ok: true };
}

// Só apaga vazia (C1): com itens, o banco recusa com category_not_empty →
// reason "not_empty" (o app mostra 55b com os números de countCategoryItems).
export async function deleteCategory(
  supabase: SupabaseClient,
  id: string,
): Promise<CategoryResult> {
  const { data, error } = await supabase
    .from("categories")
    .delete()
    .eq("id", id)
    .select("id");

  if (error) return failure(error);
  if (!data || data.length === 0) return NOT_FOUND;
  return { ok: true };
}

// Itens da categoria por aba (55b: "💛 {a} em Queremos" · "✓ {b} em Já fizemos").
export async function countCategoryItems(
  supabase: SupabaseClient,
  categoryId: string,
): Promise<CategoryResult<{ want: number; done: number }>> {
  const count = (status: "want" | "done") =>
    supabase
      .from("items")
      .select("id", { count: "exact", head: true })
      .eq("category_id", categoryId)
      .eq("status", status);

  const [want, done] = await Promise.all([count("want"), count("done")]);
  if (want.error) return failure(want.error);
  if (done.error) return failure(done.error);
  return { ok: true, want: want.count ?? 0, done: done.count ?? 0 };
}

// Grade/Compacta de cada pessoa (C11); profiles_update_self só deixa gravar a própria.
export async function setItemView(
  supabase: SupabaseClient,
  userId: string,
  view: ItemView,
): Promise<CategoryResult> {
  const { data, error } = await supabase
    .from("profiles")
    .update({ item_view: view })
    .eq("id", userId)
    .select("id");

  if (error) return failure(error);
  if (!data || data.length === 0) return NOT_FOUND;
  return { ok: true };
}
