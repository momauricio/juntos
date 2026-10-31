import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import { ItemForm, type ItemFormState } from "@/components/item-form";
import { RatingDisclosure } from "@/components/rating-disclosure";
import { RatingForm, type RatingFormState } from "@/components/rating-form";
import { STATUS_LABELS, TYPE_LABELS } from "@/lib/labels";
import {
  assertScore,
  COMMENT_MAX_LENGTH,
  coupleScore,
  formatScore,
  personAverage,
} from "@/lib/ratings";
import { addedByLabel, editedByLabel } from "@/lib/relative-time";
import { signInPathWithNext } from "@/lib/auth-callback";
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

function ratingChips(rating: Rating) {
  if (
    rating.food != null &&
    rating.service != null &&
    rating.ambiance != null
  ) {
    return [
      `Comida ${rating.food}`,
      `Atendimento ${rating.service}`,
      `Ambiente ${rating.ambiance}`,
    ];
  }

  return rating.score != null ? [`Nota ${rating.score}`] : [];
}

function formatDayMonth(timestamp: string) {
  return new Date(timestamp).toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    timeZone: "America/Sao_Paulo",
  });
}

export async function generateMetadata({
  params,
}: ItemPageProps): Promise<Metadata> {
  const { id } = await params;
  const supabase = await createClient();
  const { data } = await supabase
    .from("items")
    .select("title")
    .eq("id", id)
    .maybeSingle();

  return { title: data?.title?.trim() || "Ideia" };
}

export default async function ItemPage({ params }: ItemPageProps) {
  const { id } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect(signInPathWithNext(`/items/${id}`));
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
  const ratings = (data as Item & { ratings: Rating[] | null }).ratings ?? [];

  const { data: memberRows, error: membersError } = await supabase
    .from("space_members")
    .select("user_id")
    .eq("space_id", membership.space_id)
    .order("joined_at", { ascending: true });

  if (membersError) {
    throw new Error("Não foi possível carregar os membros.");
  }

  const memberIds = (memberRows ?? []).map(
    (member) => member.user_id as string,
  );
  const personIds = Array.from(
    new Set([
      ...memberIds,
      ...ratings.map((rating) => rating.rated_by),
      item.created_by,
      ...(item.updated_by ? [item.updated_by] : []),
    ]),
  );
  const { data: profileRows } = await supabase
    .from("profiles")
    .select("id,display_name")
    .in("id", personIds);

  const profilesById = new Map(
    ((profileRows ?? []) as ProfileRow[]).map((profile) => [
      profile.id,
      profile.display_name,
    ]),
  );
  const nameOf = (profileId: string) =>
    profilesById.get(profileId) ??
    (profileId === user.id ? "Você" : "Pessoa do espaço");
  const creatorName = nameOf(item.created_by);
  const editedLabel = editedByLabel(item, profilesById);
  const ratingsByPerson = new Map(
    ratings.map((rating) => [rating.rated_by, rating]),
  );
  const people = Array.from(
    new Set([...memberIds, ...ratings.map((rating) => rating.rated_by)]),
  ).map((personId) => ({
    id: personId,
    name: nameOf(personId),
    rating: ratingsByPerson.get(personId) ?? null,
  }));
  const raters = people.filter((person) => person.rating);
  const myRating = ratingsByPerson.get(user.id) ?? null;
  const couple = coupleScore(ratings);
  const coupleCaption =
    raters.length === 1
      ? `só ${raters[0].name} deu nota até agora`
      : "média de vocês dois";

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
      redirect(signInPathWithNext(`/items/${id}`));
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
      redirect(signInPathWithNext(`/items/${id}`));
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

    const comment = formValue(formData, "comment");

    if (comment.length > COMMENT_MAX_LENGTH) {
      return {
        error: `O comentário pode ter até ${COMMENT_MAX_LENGTH} caracteres.`,
      };
    }

    let ratingParams:
      | {
          p_item_id: string;
          p_food: number;
          p_service: number;
          p_ambiance: number;
          p_score: null;
          p_comment: string | null;
        }
      | {
          p_item_id: string;
          p_food: null;
          p_service: null;
          p_ambiance: null;
          p_score: number;
          p_comment: string | null;
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
              p_comment: comment || null,
            }
          : {
              p_item_id: actionItem.id as string,
              p_food: null,
              p_service: null,
              p_ambiance: null,
              p_score: scoreValue(formData, "score"),
              p_comment: comment || null,
            };
    } catch {
      return { error: "Informe uma nota de 1 a 10." };
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
        {item.status === "done" ? (
          <Link
            href="/?status=done"
            className="inline-flex min-h-11 items-center text-sm font-semibold text-accent-strong transition hover:text-accent"
          >
            ← {STATUS_LABELS.done}
          </Link>
        ) : (
          <Link
            href="/"
            className="inline-flex min-h-11 items-center text-sm font-semibold text-accent-strong transition hover:text-accent"
          >
            Voltar para a lista
          </Link>
        )}

        <div className="space-y-3">
          {item.status === "done" && item.completed_at ? (
            <span className="inline-flex rounded-2xl bg-accent-soft px-3 py-1 text-sm font-semibold text-accent-strong">
              ✓ {STATUS_LABELS.done} · {formatDayMonth(item.completed_at)}
            </span>
          ) : null}
          <h1 className="font-serif text-4xl font-semibold tracking-tight text-foreground sm:text-5xl">
            {item.title}
          </h1>
          <p className="text-base text-foreground/70">
            {TYPE_LABELS[item.type]}
          </p>
          <div className="flex flex-col gap-1 text-sm text-foreground/65 sm:flex-row sm:gap-4">
            <p>{addedByLabel(creatorName, item.created_at)}</p>
            {editedLabel ? <p>{editedLabel}</p> : null}
          </div>
        </div>

        <div className="rounded-3xl bg-surface p-6 ring-1 ring-border">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-sm font-semibold uppercase tracking-[0.18em] text-accent">
                Nota do casal
              </p>
              {couple != null ? (
                <p className="mt-1 text-sm text-foreground/70">
                  {coupleCaption}
                </p>
              ) : null}
            </div>
            {couple != null ? (
              <p className="font-serif text-5xl font-semibold tracking-tight text-accent">
                {formatScore(couple)}
              </p>
            ) : null}
          </div>

          {couple != null ? (
            <ul className="mt-5 divide-y divide-border border-t border-border">
              {people.map((person) => {
                const average = person.rating
                  ? personAverage(person.rating)
                  : null;

                return (
                  <li key={person.id} className="space-y-3 py-4 last:pb-0">
                    <div className="flex items-center justify-between gap-3">
                      <div className="flex items-center gap-3">
                        <span
                          aria-hidden
                          className="flex size-8 items-center justify-center rounded-full bg-accent text-sm font-semibold text-accent-contrast"
                        >
                          {person.name.charAt(0).toUpperCase()}
                        </span>
                        <span className="font-semibold">{person.name}</span>
                      </div>
                      {average != null ? (
                        <span className="rounded-2xl bg-accent-soft px-3 py-1 text-sm font-semibold text-accent-strong">
                          {formatScore(average)}
                        </span>
                      ) : null}
                    </div>
                    {person.rating ? (
                      <>
                        <div className="flex flex-wrap gap-2">
                          {ratingChips(person.rating).map((chip) => (
                            <span
                              key={chip}
                              className="rounded-2xl bg-surface-muted px-3 py-1 text-sm font-medium text-foreground/80"
                            >
                              {chip}
                            </span>
                          ))}
                        </div>
                        {person.rating.comment ? (
                          <p className="text-sm italic leading-6 text-foreground/70">
                            “{person.rating.comment}”
                          </p>
                        ) : null}
                      </>
                    ) : (
                      <p className="text-sm text-foreground/65">
                        {person.name} ainda não deu nota
                      </p>
                    )}
                  </li>
                );
              })}
            </ul>
          ) : (
            <p className="mt-3 text-sm leading-6 text-foreground/70">
              Ainda sem nota. Salvem a primeira avaliação quando fizerem esta
              ideia.
            </p>
          )}
        </div>

        <RatingDisclosure
          summary={myRating ? "✎ Editar minha nota" : "Dar minha nota"}
          status={item.status}
          hasMyRating={myRating != null}
          userId={user.id}
          itemId={item.id}
        >
          <RatingForm action={saveRating} item={item} rating={myRating} />
        </RatingDisclosure>

        <ItemForm action={updateItem} item={item} mode="edit" />
      </section>
    </main>
  );
}
