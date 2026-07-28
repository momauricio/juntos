import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import { ItemForm, type ItemFormState } from "@/components/item-form";
import { RatingForm, type RatingFormState } from "@/components/rating-form";
import { STATUS_LABELS, TYPE_LABELS } from "@/lib/labels";
import { assertScore, displayRating, restaurantAverage } from "@/lib/ratings";
import { createClient } from "@/lib/supabase/server";
import type { Item, Rating } from "@/lib/types";

type ItemPageProps = {
  params: Promise<{
    id: string;
  }>;
};

type ProfileRow = {
  id: string;
  display_name: string;
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
  const profileIds = Array.from(
    new Set(
      [item.created_by, rating?.rated_by].filter(
        (profileId): profileId is string => Boolean(profileId),
      ),
    ),
  );
  let profiles: ProfileRow[] = [];

  if (profileIds.length > 0) {
    const { data: profileRows } = await supabase
      .from("profiles")
      .select("id,display_name")
      .in("id", profileIds);

    profiles = (profileRows ?? []) as ProfileRow[];
  }

  const profilesById = new Map(
    profiles.map((profile) => [profile.id, profile.display_name]),
  );
  const creatorName = profilesById.get(item.created_by) ?? "Pessoa do espaço";
  const lastRaterName = rating
    ? (profilesById.get(rating.rated_by) ?? "Pessoa do espaço")
    : null;

  async function updateItem(
    _state: ItemFormState,
    formData: FormData,
  ): Promise<ItemFormState> {
    "use server";

    const title = formValue(formData, "title");
    const url = formValue(formData, "url");
    const notes = formValue(formData, "notes");

    if (!title) {
      return { error: "Informe um título para a ideia." };
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
      return { error: "Não foi possível salvar a ideia. Tente novamente." };
    }

    redirect(`/items/${id}`);
  }

  async function saveRating(
    _state: RatingFormState,
    formData: FormData,
  ): Promise<RatingFormState> {
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
      .select("id,type")
      .eq("id", id)
      .eq("space_id", actionMembership.space_id)
      .maybeSingle();

    if (actionItemError) {
      return { error: "Não foi possível carregar a ideia. Tente novamente." };
    }

    if (!actionItem) {
      notFound();
    }

    let ratingParams:
      | {
          p_item_id: string;
          p_food: number;
          p_service: number;
          p_ambiance: number;
          p_score: null;
        }
      | {
          p_item_id: string;
          p_food: null;
          p_service: null;
          p_ambiance: null;
          p_score: number;
        };

    try {
      ratingParams =
        actionItem.type === "restaurant"
          ? {
              p_item_id: actionItem.id as string,
              p_food: scoreValue(formData, "food"),
              p_service: scoreValue(formData, "service"),
              p_ambiance: scoreValue(formData, "ambiance"),
              p_score: null,
            }
          : {
              p_item_id: actionItem.id as string,
              p_food: null,
              p_service: null,
              p_ambiance: null,
              p_score: scoreValue(formData, "score"),
            };
    } catch {
      return { error: "Informe uma nota de 1 a 5." };
    }

    const { error: ratingError } = await actionSupabase.rpc(
      "complete_item_with_rating",
      ratingParams,
    );

    if (ratingError) {
      return { error: "Não foi possível salvar a nota. Tente novamente." };
    }

    redirect(`/items/${id}`);
  }

  return (
    <main className="px-4 pb-24 pt-8 sm:pb-12">
      <section className="mx-auto w-full max-w-2xl space-y-6">
        <Link
          href="/"
          className="inline-flex min-h-11 items-center text-sm font-semibold text-accent-strong transition hover:text-accent"
        >
          Voltar para a lista
        </Link>

        <div className="space-y-3">
          <p className="text-sm font-semibold uppercase tracking-[0.18em] text-accent">
            {TYPE_LABELS[item.type]} · {STATUS_LABELS[item.status]}
          </p>
          <h1 className="font-serif text-4xl font-semibold tracking-tight text-foreground sm:text-5xl">
            {item.title}
          </h1>
          <p className="text-base leading-7 text-foreground/70">
            Marque como feito, salve a nota compartilhada e ajuste título, URL
            ou notas quando precisarem.
          </p>
          <div className="flex flex-col gap-1 text-sm text-foreground/65 sm:flex-row sm:gap-4">
            <p>Criada por {creatorName}</p>
            {lastRaterName ? <p>Última nota por {lastRaterName}</p> : null}
          </div>
        </div>

        <div className="rounded-3xl bg-surface p-6 ring-1 ring-border">
          <p className="text-sm font-semibold uppercase tracking-[0.18em] text-accent">
            Nota atual
          </p>
          {currentRatingLabel ? (
            <div className="mt-3 space-y-2">
              <p className="font-serif text-2xl font-semibold tracking-tight">
                {currentRatingLabel}
              </p>
              {currentRestaurantDetails ? (
                <p className="text-sm leading-6 text-foreground/70">
                  {currentRestaurantDetails}
                </p>
              ) : null}
            </div>
          ) : (
            <p className="mt-3 text-sm leading-6 text-foreground/70">
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
