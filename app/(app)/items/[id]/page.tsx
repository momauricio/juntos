import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import { memberTone } from "@/components/avatar";
import { EditConflictToast } from "@/components/edit-conflict-toast";
import { ItemForm, type ItemFormState } from "@/components/item-form";
import {
  ActivityNoAddressNote,
  CoupleScoreCard,
  EditDisclosure,
  heroBadge,
  heroCategoryLabel,
  ItemHero,
  ItemNotesCard,
  ratingChips,
} from "@/components/item-visuals";
import { RatingDisclosure } from "@/components/rating-disclosure";
import { RatingForm, type RatingFormState } from "@/components/rating-form";
import { SavedRatingPrompt } from "@/components/saved-rating-prompt";
import { BACK_LINK } from "@/components/ui-classes";
import {
  findCategory,
  parseCategoryField,
  PICK_CATEGORY_COPY,
} from "@/lib/categories";
import { getCategory, listCategories } from "@/lib/categories-data";
import { normalizeCity } from "@/lib/city";
import {
  EDIT_CONFLICT_PARAM,
  editConflictMessage,
  editConflictWith,
  isUuid,
} from "@/lib/edit-conflict";
import { STATUS_LABELS } from "@/lib/labels";
import {
  COMMENT_MAX_LENGTH,
  coupleScore,
  parseScore,
  personAverage,
  SCORE_ERROR,
} from "@/lib/ratings";
import {
  addedByLabel,
  editedByLabel,
  UNKNOWN_AUTHOR_NAME,
} from "@/lib/relative-time";
import { signInPathWithNext } from "@/lib/auth-callback";
import { getAuthUser, getMySpaceId } from "@/lib/session";
import { createClient } from "@/lib/supabase/server";
import type { Category, Item, Rating } from "@/lib/types";

type ItemPageProps = {
  params: Promise<{
    id: string;
  }>;
  searchParams: Promise<{
    [EDIT_CONFLICT_PARAM]?: string | string[];
  }>;
};

const SAVE_ERROR = "Não foi possível salvar a ideia. Tente novamente.";

type ProfileRow = {
  id: string;
  display_name: string;
};

function formValue(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === "string" ? value.trim() : "";
}

// "8,2" → 8.2 (vírgula vira ponto) antes de ir para a RPC.
function scoreValue(formData: FormData, key: string) {
  return parseScore(formValue(formData, key));
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

export default async function ItemPage({
  params,
  searchParams,
}: ItemPageProps) {
  const { id } = await params;
  // Quem gravou antes de mim enquanto eu editava (?mexeu=id, ver updateItem).
  const conflictParam = (await searchParams)[EDIT_CONFLICT_PARAM];
  const conflictWith = isUuid(conflictParam) ? conflictParam : null;
  const user = await getAuthUser();

  if (!user) {
    redirect(signInPathWithNext(`/items/${id}`));
  }

  const spaceId = await getMySpaceId(user.id);

  if (!spaceId) {
    redirect("/onboarding");
  }

  const supabase = await createClient();

  // Item (+ratings), membros e categorias não dependem uns dos outros — só
  // do spaceId, já resolvido acima — então saem juntos em vez de em série.
  const [itemResult, membersResult, categoriesResult] = await Promise.all([
    supabase
      .from("items")
      .select("*, ratings(*)")
      .eq("id", id)
      .eq("space_id", spaceId)
      .maybeSingle(),
    supabase
      .from("space_members")
      .select("user_id")
      .eq("space_id", spaceId)
      .order("joined_at", { ascending: true }),
    // Categorias do espaço: a do item no topo do detalhe (emoji, nome e cor)
    // e todas no campo "Categoria" do ✎ Editar.
    listCategories(supabase, spaceId),
  ]);

  const { data, error } = itemResult;

  if (error) {
    throw new Error("Não foi possível carregar a ideia.");
  }

  if (!data) {
    notFound();
  }

  const item = data as Item;
  const ratings = (data as Item & { ratings: Rating[] | null }).ratings ?? [];

  const { data: memberRows, error: membersError } = membersResult;

  if (membersError) {
    throw new Error("Não foi possível carregar os membros.");
  }

  const categories = categoriesResult.ok ? categoriesResult.categories : [];
  const category: Pick<Category, "name" | "emoji" | "color"> | null =
    findCategory(categories, item.category_id);

  const memberIds = (memberRows ?? []).map(
    (member) => member.user_id as string,
  );
  const personIds = Array.from(
    new Set([
      ...memberIds,
      ...ratings.map((rating) => rating.rated_by),
      item.created_by,
      ...(item.updated_by ? [item.updated_by] : []),
      ...(conflictWith ? [conflictWith] : []),
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
    const city = normalizeCity(formData.get("city"));
    const categoryId = parseCategoryField(formData.get("category_id"));

    if (!categoryId) {
      return { error: PICK_CATEGORY_COPY };
    }

    if (!title) {
      return { error: "Informe um título para a ideia." };
    }

    // Sem texto próprio na spec: o maxLength do campo já barra antes.
    if (!city.ok) {
      return { error: SAVE_ERROR };
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

    // Categoria de outro espaço (ou que sumiu): recusa antes do banco
    // (que também recusa: category_other_space). O type não muda.
    const targetCategory = await getCategory(
      actionSupabase,
      actionMembership.space_id,
      categoryId,
    );
    if (!targetCategory.ok) {
      return { error: PICK_CATEGORY_COPY };
    }

    // Vale a última gravação; só olha antes para saber se o par mexeu depois
    // que esta tela carregou (lib/edit-conflict.ts).
    const { data: current, error: currentError } = await actionSupabase
      .from("items")
      .select("updated_at,updated_by")
      .eq("id", id)
      .eq("space_id", actionMembership.space_id)
      .maybeSingle();

    if (currentError) {
      return { error: "Não foi possível salvar a ideia. Tente novamente." };
    }

    if (!current) {
      notFound();
    }

    const otherEditor = editConflictWith({
      loadedUpdatedAt: formValue(formData, "loaded_updated_at"),
      current,
      userId: actionUser.id,
    });

    const { error: updateError } = await actionSupabase
      .from("items")
      .update({
        title,
        url: url || null,
        notes: notes || null,
        city: city.city,
        category_id: targetCategory.category.id,
        updated_at: new Date().toISOString(),
      })
      .eq("id", id)
      .eq("space_id", actionMembership.space_id);

    if (updateError) {
      return { error: SAVE_ERROR };
    }

    redirect(
      otherEditor
        ? `/items/${id}?${EDIT_CONFLICT_PARAM}=${otherEditor}`
        : `/items/${id}`,
    );
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
      return { error: SCORE_ERROR };
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
      {conflictWith ? (
        <EditConflictToast
          key={item.updated_at}
          message={editConflictMessage(
            profilesById.get(conflictWith) ?? UNKNOWN_AUTHOR_NAME,
          )}
        />
      ) : null}
      <section data-coluna="leitura" className="mx-auto w-full max-w-lg space-y-3.5 md:max-w-2xl lg:pt-4">
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
          category={category}
          title={item.title}
          subtitle={heroCategoryLabel(item.type, category)}
          author={{
            name: creatorName,
            tone: memberTone(memberIds.indexOf(item.created_by)),
            addedLabel: addedByLabel(creatorName, item.created_at),
          }}
          badge={heroBadge(item)}
        >
          {editedLabel ? (
            <p className="mt-1 text-[13px] text-cream/55">{editedLabel}</p>
          ) : null}
        </ItemHero>

        <ItemNotesCard item={item} />

        <ActivityNoAddressNote item={item} />

        {/* Em Queremos, sem nota de ninguém, o card vazio não aparece. */}
        {item.status === "done" || couple != null ? (
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
        ) : null}

        <RatingDisclosure
          summary={
            item.status === "want"
              ? `✓ ${STATUS_LABELS.done}`
              : myRating
                ? "✎ Editar minha nota"
                : "Dar minha nota"
          }
          primary={item.status === "want"}
          status={item.status}
          hasMyRating={myRating != null}
          userId={user.id}
          itemId={item.id}
        >
          <SavedRatingPrompt />
          <RatingForm action={saveRating} item={item} rating={myRating} />
        </RatingDisclosure>

        {/* Remonta depois de salvar (updated_at muda): fecha e pega os valores novos. */}
        <EditDisclosure key={item.updated_at}>
          <ItemForm
            action={updateItem}
            item={item}
            mode="edit"
            categories={categories}
          />
        </EditDisclosure>
      </section>
    </main>
  );
}
