import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { ItemForm, type ItemFormState } from "@/components/item-form";
import { EYEBROW_ACCENT, SUBTITLE, TITLE } from "@/components/ui-classes";
import { savedRedirectPath } from "@/lib/capture-link";
import {
  findCategory,
  NEW_ITEM_CATEGORY_PARAM,
  newItemCategoryFields,
  parseCategoryField,
  PICK_CATEGORY_COPY,
} from "@/lib/categories";
import { getCategory, listCategories } from "@/lib/categories-data";
import { normalizeCity } from "@/lib/city";
import { signInPathWithNext } from "@/lib/auth-callback";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = {
  title: "Adicionar à lista",
};

const CREATE_ERROR = "Não foi possível criar a ideia. Tente novamente.";

function formValue(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === "string" ? value.trim() : "";
}

async function createItem(
  _state: ItemFormState,
  formData: FormData,
): Promise<ItemFormState> {
  "use server";

  const categoryId = parseCategoryField(formData.get("category_id"));
  const title = formValue(formData, "title");
  const url = formValue(formData, "url");
  const notes = formValue(formData, "notes");
  const city = normalizeCity(formData.get("city"));

  if (!categoryId) {
    return { error: PICK_CATEGORY_COPY };
  }

  if (!title) {
    return { error: "Informe um título para a ideia." };
  }

  // Sem texto próprio na spec: o maxLength do campo já barra antes.
  if (!city.ok) {
    return { error: CREATE_ERROR };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect(signInPathWithNext("/items/new"));
  }

  const { data: membership } = await supabase
    .from("space_members")
    .select("space_id")
    .eq("user_id", user.id)
    .maybeSingle();

  if (!membership) {
    redirect("/onboarding");
  }

  // A categoria tem que ser deste espaço (o banco também confere:
  // category_other_space). O type do item novo sai dela.
  const category = await getCategory(supabase, membership.space_id, categoryId);
  if (!category.ok) {
    return { error: PICK_CATEGORY_COPY };
  }

  const { data, error } = await supabase
    .from("items")
    .insert({
      space_id: membership.space_id,
      ...newItemCategoryFields(category.category),
      title,
      url: url || null,
      notes: notes || null,
      city: city.city,
      status: "want",
      created_by: user.id,
    })
    .select("id")
    .single();

  if (error || !data) {
    return { error: CREATE_ERROR };
  }

  redirect(savedRedirectPath("want", data.id as string));
}

type NewItemPageProps = {
  searchParams: Promise<{ categoria?: string | string[] }>;
};

// Categorias do espaço; ?categoria={id} vem do "+ Adicionar em {nome}".
async function loadCategories(param: string | string[] | undefined) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect(signInPathWithNext("/items/new"));

  const { data: membership } = await supabase
    .from("space_members")
    .select("space_id")
    .eq("user_id", user.id)
    .maybeSingle();
  if (!membership) redirect("/onboarding");

  const result = await listCategories(supabase, membership.space_id as string);
  if (!result.ok) throw new Error("Não foi possível carregar as categorias.");

  const id = Array.isArray(param) ? param[0] : param;
  const preselected = findCategory(result.categories, id ?? null);
  return { categories: result.categories, categoryId: preselected?.id ?? null };
}

export default async function NewItemPage({ searchParams }: NewItemPageProps) {
  const { categories, categoryId } = await loadCategories(
    (await searchParams)[NEW_ITEM_CATEGORY_PARAM],
  );

  return (
    <main className="px-5 pb-24 pt-2 sm:pb-12">
      <section className="mx-auto w-full max-w-lg space-y-6 md:max-w-2xl lg:pt-4">
        <div className="space-y-2.5">
          <p className={EYEBROW_ACCENT}>Nova ideia</p>
          <h1 className={TITLE}>Adicionar à lista</h1>
          <p className={SUBTITLE}>
            Escolha a categoria, dê um título e salve como algo que vocês
            querem fazer.
          </p>
        </div>

        <ItemForm
          action={createItem}
          mode="create"
          categories={categories}
          categoryId={categoryId}
        />
      </section>
    </main>
  );
}
