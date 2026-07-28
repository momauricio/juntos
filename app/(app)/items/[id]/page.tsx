import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import { ItemForm } from "@/components/item-form";
import { STATUS_LABELS, TYPE_LABELS } from "@/lib/labels";
import { createClient } from "@/lib/supabase/server";
import type { Item } from "@/lib/types";

type ItemPageProps = {
  params: Promise<{
    id: string;
  }>;
};

function formValue(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === "string" ? value.trim() : "";
}

export default async function ItemPage({ params }: ItemPageProps) {
  const { id } = await params;
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

  const { data, error } = await supabase
    .from("items")
    .select("*")
    .eq("id", id)
    .eq("space_id", membership.space_id)
    .maybeSingle();

  if (error) {
    throw new Error("Não foi possível carregar a ideia.");
  }

  if (!data) {
    notFound();
  }

  const item = data as Item;

  async function updateItem(formData: FormData) {
    "use server";

    const title = formValue(formData, "title");
    const url = formValue(formData, "url");
    const notes = formValue(formData, "notes");

    if (!title) {
      throw new Error("Informe um título para a ideia.");
    }

    const actionSupabase = await createClient();
    const {
      data: { user: actionUser },
    } = await actionSupabase.auth.getUser();

    if (!actionUser) {
      redirect("/login");
    }

    const { data: actionMembership } = await actionSupabase
      .from("space_members")
      .select("space_id")
      .eq("user_id", actionUser.id)
      .maybeSingle();

    if (!actionMembership) {
      redirect("/onboarding");
    }

    const { error: updateError } = await actionSupabase
      .from("items")
      .update({
        title,
        url: url || null,
        notes: notes || null,
        updated_at: new Date().toISOString(),
      })
      .eq("id", id)
      .eq("space_id", actionMembership.space_id);

    if (updateError) {
      throw new Error("Não foi possível salvar a ideia.");
    }

    redirect(`/items/${id}`);
  }

  return (
    <main className="px-4 py-8">
      <section className="mx-auto w-full max-w-2xl space-y-6">
        <Link
          href="/"
          className="text-sm font-semibold text-rose-600 transition hover:text-rose-700"
        >
          Voltar para a lista
        </Link>

        <div className="space-y-3">
          <p className="text-sm font-medium uppercase tracking-[0.2em] text-rose-500">
            {TYPE_LABELS[item.type]} · {STATUS_LABELS[item.status]}
          </p>
          <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">
            {item.title}
          </h1>
          <p className="text-sm leading-6 text-stone-600">
            Ajuste título, URL e notas. As avaliações entram em uma próxima
            etapa.
          </p>
        </div>

        <ItemForm action={updateItem} item={item} mode="edit" />
      </section>
    </main>
  );
}
