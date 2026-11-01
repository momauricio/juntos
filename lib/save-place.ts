import { redirect } from "next/navigation";

import { signInPathWithNext } from "@/lib/auth-callback";
import { captureLink } from "@/lib/capture-link";
import {
  newItemCategoryFields,
  parseCategoryField,
  PICK_CATEGORY_COPY,
} from "@/lib/categories";
import { getCategory, listCategories } from "@/lib/categories-data";
import { normalizeCity } from "@/lib/city";
import { INVITE_UNKNOWN_ERROR } from "@/lib/invites";
import { createClient } from "@/lib/supabase/server";
import type { Category, ItemStatus } from "@/lib/types";

// Logado e com espaço; senão, login (voltando para `path`) ou tela "Seu nome".
export async function requireSpace(path: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect(signInPathWithNext(path));
  }

  const { data: membership } = await supabase
    .from("space_members")
    .select("space_id")
    .eq("user_id", user.id)
    .maybeSingle();

  if (!membership) {
    redirect("/onboarding/nome");
  }

  return { supabase, spaceId: membership.space_id as string };
}

function formValue(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === "string" ? value.trim() : "";
}

export type SavePlaceResult =
  | { ok: true; status: ItemStatus; id: string }
  | { ok: false; error: string };

export async function savePlace(
  formData: FormData,
  path: string,
): Promise<SavePlaceResult> {
  const title = formValue(formData, "title");
  const categoryId = parseCategoryField(formData.get("category_id"));
  const url = captureLink(formValue(formData, "url"));
  const notes = formValue(formData, "notes");
  const city = normalizeCity(formData.get("city"));
  const status: ItemStatus =
    formValue(formData, "status") === "done" ? "done" : "want";

  if (!categoryId) {
    return { ok: false, error: PICK_CATEGORY_COPY };
  }

  if (!title || !url || !city.ok) {
    return { ok: false, error: INVITE_UNKNOWN_ERROR };
  }

  const { supabase, spaceId } = await requireSpace(path);
  // Só categoria deste espaço (o banco também confere: category_other_space).
  // O type do item novo sai de category.item_type.
  const category = await getCategory(supabase, spaceId, categoryId);
  if (!category.ok) {
    return { ok: false, error: PICK_CATEGORY_COPY };
  }

  const { data, error } = await supabase
    .from("items")
    .insert({
      space_id: spaceId,
      ...newItemCategoryFields(category.category),
      title,
      url,
      notes: notes || null,
      city: city.ok ? city.city : null,
      status,
      completed_at: status === "done" ? new Date().toISOString() : null,
    })
    .select("id")
    .single();

  return error || !data
    ? { ok: false, error: INVITE_UNKNOWN_ERROR }
    : { ok: true, status, id: data.id as string };
}

// Categorias do espaço para o campo "Categoria" do card de revisão.
export async function loadSpaceCategories(path: string): Promise<Category[]> {
  const { supabase, spaceId } = await requireSpace(path);
  const result = await listCategories(supabase, spaceId);
  if (!result.ok) {
    throw new Error("Não foi possível carregar as categorias.");
  }
  return result.categories;
}
