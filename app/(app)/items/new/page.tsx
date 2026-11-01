import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { ItemForm, type ItemFormState } from "@/components/item-form";
import { EYEBROW_ACCENT, SUBTITLE, TITLE } from "@/components/ui-classes";
import { savedRedirectPath } from "@/lib/capture-link";
import { NEW_ITEM_CATEGORY_PARAM } from "@/lib/categories";
import { getCategory } from "@/lib/categories-data";
import { normalizeCity } from "@/lib/city";
import { TYPE_LABELS } from "@/lib/labels";
import { signInPathWithNext } from "@/lib/auth-callback";
import { createClient } from "@/lib/supabase/server";
import type { ItemType } from "@/lib/types";

export const metadata: Metadata = {
  title: "Adicionar à lista",
};

const ITEM_TYPES = Object.keys(TYPE_LABELS) as ItemType[];
const CREATE_ERROR = "Não foi possível criar a ideia. Tente novamente.";

function formValue(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === "string" ? value.trim() : "";
}

function parseType(value: string) {
  if (ITEM_TYPES.includes(value as ItemType)) {
    return value as ItemType;
  }

  return null;
}

async function createItem(
  _state: ItemFormState,
  formData: FormData,
): Promise<ItemFormState> {
  "use server";

  const type = parseType(formValue(formData, "type"));
  const title = formValue(formData, "title");
  const url = formValue(formData, "url");
  const notes = formValue(formData, "notes");
  const city = normalizeCity(formData.get("city"));
  const categoryId = formValue(formData, "category_id");

  if (!type) {
    return { error: "Escolha um tipo válido." };
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

  // Aberto de dentro de uma categoria: vai para ela se o tipo ainda é o dela.
  // Senão (ou se ela sumiu), o trigger items_fill_category usa a padrão do tipo.
  const category = categoryId
    ? await getCategory(supabase, membership.space_id, categoryId)
    : null;
  const categoryForItem =
    category?.ok && category.category.item_type === type
      ? category.category.id
      : null;

  const { data, error } = await supabase
    .from("items")
    .insert({
      space_id: membership.space_id,
      type,
      title,
      url: url || null,
      notes: notes || null,
      city: city.city,
      ...(categoryForItem ? { category_id: categoryForItem } : {}),
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

// ?categoria={id}: vem do "+ Adicionar em {nome}" de dentro da categoria.
async function loadPreselectedCategory(param: string | string[] | undefined) {
  const id = Array.isArray(param) ? param[0] : param;
  if (!id) return null;

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

  const result = await getCategory(supabase, membership.space_id as string, id);
  return result.ok
    ? { id: result.category.id, item_type: result.category.item_type }
    : null;
}

export default async function NewItemPage({ searchParams }: NewItemPageProps) {
  const category = await loadPreselectedCategory(
    (await searchParams)[NEW_ITEM_CATEGORY_PARAM],
  );

  return (
    <main className="px-5 pb-24 pt-2 sm:pb-12">
      <section className="mx-auto w-full max-w-lg space-y-6">
        <div className="space-y-2.5">
          <p className={EYEBROW_ACCENT}>Nova ideia</p>
          <h1 className={TITLE}>Adicionar à lista</h1>
          <p className={SUBTITLE}>
            Escolha o tipo, dê um título e salve como algo que vocês querem
            fazer.
          </p>
        </div>

        <ItemForm action={createItem} mode="create" category={category} />
      </section>
    </main>
  );
}
