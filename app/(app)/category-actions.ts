"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import {
  CATEGORY_COLORS,
  CATEGORY_DELETED_PARAM,
  CATEGORY_UNKNOWN_ERROR,
  categorySaveErrorMessage,
  homeHref,
  validateCategoryInput,
  type CategoryCounts,
  type CategoryInput,
} from "@/lib/categories";
import {
  countCategoryItems,
  createCategory,
  deleteCategory,
  getCategory,
  listCategories,
  moveCategories,
  updateCategory,
} from "@/lib/categories-data";
import { createClient } from "@/lib/supabase/server";

// Criar, editar, reordenar e apagar categoria (telas 54/55). A RLS e os
// triggers do banco garantem as regras; aqui o app valida antes para mostrar
// a microcopy da folha 54. O par vê a mudança pelo Realtime (C9).

export type CategorySaveResult = { ok: true; id: string } | { ok: false; error: string };
export type CategoryCountResult = ({ ok: true } & CategoryCounts) | { ok: false };
export type CategoryRemoveResult =
  | { ok: true }
  // Corrida: o par pôs um item agora → 55b com os números atualizados.
  | ({ ok: false; reason: "not_empty" } & CategoryCounts)
  | { ok: false; reason: "unknown" };

async function mySpace() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: membership } = await supabase
    .from("space_members")
    .select("space_id")
    .eq("user_id", user.id)
    .maybeSingle();
  if (!membership) return null;

  return { supabase, spaceId: membership.space_id as string };
}

// Só o que a folha manda, com a cor dentro da paleta P.
function cleanInput(input: CategoryInput): CategoryInput | null {
  if (
    !input ||
    typeof input.name !== "string" ||
    typeof input.emoji !== "string" ||
    !CATEGORY_COLORS.some((color) => color.token === input.color)
  ) {
    return null;
  }
  return { name: input.name, emoji: input.emoji, color: input.color };
}

function done() {
  // O início e a categoria aberta pegam a mudança na próxima navegação.
  revalidatePath("/", "layout");
}

export async function createCategoryAction(raw: CategoryInput): Promise<CategorySaveResult> {
  const input = cleanInput(raw);
  const space = await mySpace();
  if (!input || !space) return { ok: false, error: CATEGORY_UNKNOWN_ERROR };

  const listed = await listCategories(space.supabase, space.spaceId);
  if (!listed.ok) return { ok: false, error: CATEGORY_UNKNOWN_ERROR };

  const problem = validateCategoryInput(input, listed.categories);
  if (problem) return { ok: false, error: problem };

  // position fica com o trigger: maior + 1 (C4); item_type 'activity'.
  const result = await createCategory(space.supabase, space.spaceId, input);
  if (!result.ok) {
    return {
      ok: false,
      error: categorySaveErrorMessage(result.reason, input, listed.categories),
    };
  }

  done();
  return { ok: true, id: result.category.id };
}

export async function updateCategoryAction(
  id: string,
  raw: CategoryInput,
): Promise<CategorySaveResult> {
  const input = cleanInput(raw);
  const space = await mySpace();
  if (!input || !space || typeof id !== "string") {
    return { ok: false, error: CATEGORY_UNKNOWN_ERROR };
  }

  const listed = await listCategories(space.supabase, space.spaceId);
  if (!listed.ok) return { ok: false, error: CATEGORY_UNKNOWN_ERROR };
  if (!listed.categories.some((category) => category.id === id)) {
    return { ok: false, error: CATEGORY_UNKNOWN_ERROR };
  }

  const problem = validateCategoryInput(input, listed.categories, { editingId: id });
  if (problem) return { ok: false, error: problem };

  const result = await updateCategory(space.supabase, id, input);
  if (!result.ok) {
    return {
      ok: false,
      error: categorySaveErrorMessage(result.reason, input, listed.categories, id),
    };
  }

  done();
  return { ok: true, id };
}

// A ordem da tela inteira (só ids do espaço; a RLS esconde os de fora).
export async function moveCategoriesAction(orderedIds: string[]): Promise<{ ok: boolean }> {
  const space = await mySpace();
  if (
    !space ||
    !Array.isArray(orderedIds) ||
    !orderedIds.every((id) => typeof id === "string")
  ) {
    return { ok: false };
  }

  const result = await moveCategories(space.supabase, orderedIds);
  done();
  return { ok: result.ok };
}

export async function countCategoryItemsAction(id: string): Promise<CategoryCountResult> {
  const space = await mySpace();
  if (!space || typeof id !== "string") return { ok: false };

  // Categoria de outro espaço: a RLS daria 0, e 0 abriria a 55c. Confere antes.
  const category = await getCategory(space.supabase, space.spaceId, id);
  if (!category.ok) return { ok: false };

  const counts = await countCategoryItems(space.supabase, id);
  return counts.ok ? { ok: true, want: counts.want, done: counts.done } : { ok: false };
}

// Apagando de dentro da categoria (`then` = o início com o toast): vai direto
// para lá, sem recarregar a tela da categoria que acabou de sumir.
export async function deleteCategoryAction(
  id: string,
  then?: { status: "want" | "done" },
): Promise<CategoryRemoveResult> {
  const space = await mySpace();
  if (!space || typeof id !== "string") return { ok: false, reason: "unknown" };

  const result = await deleteCategory(space.supabase, id);
  if (result.ok) {
    if (then) {
      redirect(homeHref(then.status === "done" ? "done" : "want", CATEGORY_DELETED_PARAM));
    }
    done();
    return { ok: true };
  }

  // O banco recusou (C1): conta de novo para a 55b.
  if (result.reason === "not_empty") {
    const counts = await countCategoryItems(space.supabase, id);
    if (counts.ok) {
      return { ok: false, reason: "not_empty", want: counts.want, done: counts.done };
    }
  }
  return { ok: false, reason: "unknown" };
}
