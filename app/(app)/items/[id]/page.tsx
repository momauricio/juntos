import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import { memberTone } from "@/components/avatar";
import { ItemForm, type ItemFormState } from "@/components/item-form";
import {
  CoupleScoreCard,
  formatDayMonth,
  ItemHero,
  itemSubtitle,
  ratingChips,
} from "@/components/item-visuals";
import { RatingDisclosure } from "@/components/rating-disclosure";
import { RatingForm, type RatingFormState } from "@/components/rating-form";
import { SavedRatingPrompt } from "@/components/saved-rating-prompt";
import { BACK_LINK } from "@/components/ui-classes";
import { STATUS_LABELS } from "@/lib/labels";
import {
  assertScore,
  COMMENT_MAX_LENGTH,
  coupleScore,
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
    <main className="px-5 pb-24 pt-0">
      <section className="mx-auto w-full max-w-lg space-y-3.5">
        {item.status === "done" ? (
          <Link href="/?status=done" className={BACK_LINK}>
            ← {STATUS_LABELS.done}
          </Link>
        ) : (
          <Link href="/?status=want" className={BACK_LINK}>
            ← {STATUS_LABELS.want}
          </Link>
        )}

        <ItemHero
          type={item.type}
          title={item.title}
          subtitle={itemSubtitle(item.type)}
          badge={
            item.status === "done" && item.completed_at
              ? `✓ ${STATUS_LABELS.done} · ${formatDayMonth(item.completed_at)}`
              : null
          }
        >
          <div className="mt-1 flex flex-col gap-0.5 text-[13px] text-cream/55 sm:flex-row sm:gap-4">
            <p>{addedByLabel(creatorName, item.created_at)}</p>
            {editedLabel ? <p>{editedLabel}</p> : null}
          </div>
        </ItemHero>

        <CoupleScoreCard
          couple={couple}
          caption={coupleCaption}
          emptyText="Ainda sem nota. Salvem a primeira avaliação quando fizerem esta ideia."
          people={people.map((person) => ({
            id: person.id,
            name: person.name,
            tone: memberTone(memberIds.indexOf(person.id)),
            average: person.rating ? personAverage(person.rating) : null,
            chips: person.rating ? ratingChips(person.rating) : [],
            comment: person.rating?.comment ?? null,
          }))}
        />

        <RatingDisclosure
          summary={myRating ? "✎ Editar minha nota" : "Dar minha nota"}
          status={item.status}
          hasMyRating={myRating != null}
          userId={user.id}
          itemId={item.id}
        >
          <SavedRatingPrompt />
          <RatingForm action={saveRating} item={item} rating={myRating} />
        </RatingDisclosure>

        <div className="pt-4">
          <ItemForm action={updateItem} item={item} mode="edit" />
        </div>
      </section>
    </main>
  );
}
