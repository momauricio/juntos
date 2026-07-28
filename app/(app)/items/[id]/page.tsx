import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import { ItemForm } from "@/components/item-form";
import { RatingForm } from "@/components/rating-form";
import { STATUS_LABELS, TYPE_LABELS } from "@/lib/labels";
import { assertScore, displayRating, restaurantAverage } from "@/lib/ratings";
import { createClient } from "@/lib/supabase/server";
import type { Item, Rating } from "@/lib/types";

type ItemPageProps = {
  params: Promise<{
    id: string;
  }>;
};

type RatingUpsert = {
  item_id: string;
  rated_by: string;
  food: number | null;
  service: number | null;
  ambiance: number | null;
  score: number | null;
  updated_at: string;
};

function formValue(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === "string" ? value.trim() : "";
}

function scoreValue(formData: FormData, key: string) {
  const value = Number(formValue(formData, key));
  assertScore(value);
  return value;
}

function formatRating(value: number) {
  return value.toLocaleString("pt-BR", {
    maximumFractionDigits: 1,
    minimumFractionDigits: 0,
  });
}

function ratingLabel(item: Pick<Item, "type">, rating: Rating) {
  const value = displayRating(rating);

  if (value == null) {
    return null;
  }

  return `${item.type === "restaurant" ? "Média" : "Nota"} ${formatRating(
    value,
  )}`;
}

function restaurantDetails(rating: Rating) {
  if (
    rating.food == null ||
    rating.service == null ||
    rating.ambiance == null
  ) {
    return null;
  }

  const average = restaurantAverage(
    rating.food,
    rating.service,
    rating.ambiance,
  );

  return `Comida ${rating.food} · Atendimento ${rating.service} · Ambiente ${
    rating.ambiance
  } · Média ${formatRating(average)}`;
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
    .select("*, ratings(*)")
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
  const rating = ((data as Item & { ratings: Rating[] | null }).ratings ??
    [])[0] ?? null;
  const currentRatingLabel = rating ? ratingLabel(item, rating) : null;
  const currentRestaurantDetails =
    item.type === "restaurant" && rating ? restaurantDetails(rating) : null;

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

  async function saveRating(formData: FormData) {
    "use server";

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

    const { data: actionItem, error: actionItemError } = await actionSupabase
      .from("items")
      .select("id,type,status")
      .eq("id", id)
      .eq("space_id", actionMembership.space_id)
      .maybeSingle();

    if (actionItemError) {
      throw new Error("Não foi possível carregar a ideia.");
    }

    if (!actionItem) {
      notFound();
    }

    const now = new Date().toISOString();
    const ratingPayload: RatingUpsert =
      actionItem.type === "restaurant"
        ? {
            item_id: actionItem.id as string,
            rated_by: actionUser.id,
            food: scoreValue(formData, "food"),
            service: scoreValue(formData, "service"),
            ambiance: scoreValue(formData, "ambiance"),
            score: null,
            updated_at: now,
          }
        : {
            item_id: actionItem.id as string,
            rated_by: actionUser.id,
            food: null,
            service: null,
            ambiance: null,
            score: scoreValue(formData, "score"),
            updated_at: now,
          };

    if (actionItem.status === "want") {
      const { error: statusError } = await actionSupabase
        .from("items")
        .update({
          status: "done",
          completed_at: now,
          updated_at: now,
        })
        .eq("id", actionItem.id)
        .eq("space_id", actionMembership.space_id)
        .eq("status", "want");

      if (statusError) {
        throw new Error("Não foi possível marcar a ideia como feita.");
      }
    }

    const { error: ratingError } = await actionSupabase
      .from("ratings")
      .upsert(ratingPayload, { onConflict: "item_id" });

    if (ratingError) {
      throw new Error("Não foi possível salvar a nota.");
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
            Marque como feito, salve a nota compartilhada e ajuste título, URL
            ou notas quando precisarem.
          </p>
        </div>

        <div className="rounded-3xl bg-white p-6 shadow-sm ring-1 ring-stone-200">
          <p className="text-sm font-medium uppercase tracking-[0.2em] text-rose-500">
            Nota atual
          </p>
          {currentRatingLabel ? (
            <div className="mt-3 space-y-2">
              <p className="text-2xl font-semibold tracking-tight">
                {currentRatingLabel}
              </p>
              {currentRestaurantDetails ? (
                <p className="text-sm leading-6 text-stone-600">
                  {currentRestaurantDetails}
                </p>
              ) : null}
            </div>
          ) : (
            <p className="mt-3 text-sm leading-6 text-stone-600">
              Ainda sem nota. Salvem a primeira avaliação quando fizerem esta
              ideia.
            </p>
          )}
        </div>

        <RatingForm action={saveRating} item={item} rating={rating} />

        <ItemForm action={updateItem} item={item} mode="edit" />
      </section>
    </main>
  );
}
