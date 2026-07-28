import { redirect } from "next/navigation";

import { ItemForm } from "@/components/item-form";
import { TYPE_LABELS } from "@/lib/labels";
import { createClient } from "@/lib/supabase/server";
import type { ItemType } from "@/lib/types";

const ITEM_TYPES = Object.keys(TYPE_LABELS) as ItemType[];

function formValue(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === "string" ? value.trim() : "";
}

function parseType(value: string) {
  if (ITEM_TYPES.includes(value as ItemType)) {
    return value as ItemType;
  }

  throw new Error("Escolha um tipo válido.");
}

async function createItem(formData: FormData) {
  "use server";

  const type = parseType(formValue(formData, "type"));
  const title = formValue(formData, "title");
  const url = formValue(formData, "url");
  const notes = formValue(formData, "notes");

  if (!title) {
    throw new Error("Informe um título para a ideia.");
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
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
    throw new Error("Não foi possível criar a ideia.");
  }

  redirect("/");
}

export default function NewItemPage() {
  return (
    <main className="px-4 pb-24 pt-8 sm:pb-12">
      <section className="mx-auto w-full max-w-2xl space-y-6">
        <div className="space-y-3">
          <p className="text-sm font-semibold uppercase tracking-[0.18em] text-accent">
            Nova ideia
          </p>
          <h1 className="font-serif text-4xl font-semibold tracking-tight text-foreground sm:text-5xl">
            Adicionar à lista
          </h1>
          <p className="text-base leading-7 text-foreground/70">
            Escolha o tipo, dê um título e salve como algo que vocês querem
            fazer.
          </p>
        </div>

        <ItemForm action={createItem} mode="create" />
      </section>
    </main>
  );
}
