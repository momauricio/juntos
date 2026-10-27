import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { ItemForm, type ItemFormState } from "@/components/item-form";
import { EYEBROW_ACCENT, SUBTITLE, TITLE } from "@/components/ui-classes";
import { TYPE_LABELS } from "@/lib/labels";
import { signInPathWithNext } from "@/lib/auth-callback";
import { createClient } from "@/lib/supabase/server";
import type { ItemType } from "@/lib/types";

export const metadata: Metadata = {
  title: "Adicionar à lista",
};

const ITEM_TYPES = Object.keys(TYPE_LABELS) as ItemType[];

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

  if (!type) {
    return { error: "Escolha um tipo válido." };
  }

  if (!title) {
    return { error: "Informe um título para a ideia." };
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

  const { error } = await supabase.from("items").insert({
    space_id: membership.space_id,
    type,
    title,
    url: url || null,
    notes: notes || null,
    status: "want",
    created_by: user.id,
  });

  if (error) {
    return { error: "Não foi possível criar a ideia. Tente novamente." };
  }

  redirect("/");
}

export default function NewItemPage() {
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

        <ItemForm action={createItem} mode="create" />
      </section>
    </main>
  );
}
