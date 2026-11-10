import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";

import { saveItemView } from "@/app/(app)/item-view-action";
import { AppCategoryOptions } from "@/components/app-categories";
import type { ItemWithRatings } from "@/components/item-list";
import { ItemsScreen } from "@/components/items-screen";
import { FAB } from "@/components/ui-classes";
import { signInPathWithNext } from "@/lib/auth-callback";
import {
  categoryHref,
  categoryItems,
  categorySampleText,
  categoryScoreAverage,
  categoryTitle,
  newItemHref,
  parseSortParam,
  showsScoreSort,
} from "@/lib/categories";
import { getCategory, getItemView, listCategories } from "@/lib/categories-data";
import { STATUS_LABELS } from "@/lib/labels";
import { loadMySpace } from "@/lib/space";
import { createClient } from "@/lib/supabase/server";
import type { ItemStatus } from "@/lib/types";

type CategoryPageProps = {
  params: Promise<{ id: string }>;
  searchParams: Promise<{
    status?: string | string[];
    ordem?: string | string[];
  }>;
};

function parseStatus(value: string | string[] | undefined): ItemStatus {
  const status = Array.isArray(value) ? value[0] : value;
  return status === "done" ? "done" : "want";
}

export const metadata: Metadata = {
  title: "Categoria",
};

// Dentro da categoria (telas 52/53): os itens da aba, em Grade ou Compacta
// (a escolha de cada pessoa, C11), e "Ordenar" em Restaurante/Já fizemos (C10).
export default async function CategoryPage({
  params,
  searchParams,
}: CategoryPageProps) {
  const [{ id }, query] = await Promise.all([params, searchParams]);
  const status = parseStatus(query.status);
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect(signInPathWithNext(categoryHref(id, status)));
  }

  const space = await loadMySpace(supabase, user.id);

  if (!space) {
    redirect("/onboarding");
  }

  const categoryResult = await getCategory(supabase, space.id, id);

  // Categoria de outro espaço, inexistente ou apagada agora pelo par (o
  // Realtime recarrega esta tela): volta ao início, na mesma aba.
  if (!categoryResult.ok) {
    if (categoryResult.reason === "not_found") {
      redirect(`/?status=${status}`);
    }
    throw new Error("Não foi possível carregar a categoria.");
  }

  const category = categoryResult.category;
  const [itemsResult, view, categoriesResult] = await Promise.all([
    supabase
      .from("items")
      .select("*, ratings(*)")
      .eq("space_id", space.id)
      .eq("category_id", category.id)
      .eq("status", status),
    getItemView(supabase, user.id),
    // Para a folha de editar avisar nome repetido.
    listCategories(supabase, space.id),
  ]);

  if (itemsResult.error) {
    throw new Error("Não foi possível carregar a lista.");
  }

  const withSort = showsScoreSort(category, status);
  const sort = withSort ? parseSortParam(query.ordem) : "recent";
  const items = categoryItems(
    (itemsResult.data ?? []) as ItemWithRatings[],
    category,
    status,
    sort,
  );
  const partner = space.members.find((member) => member.userId !== user.id);

  return (
    <main className="px-5 pb-28 pt-1">
      <section className="mx-auto w-full max-w-lg md:max-w-3xl lg:max-w-6xl">
        <ItemsScreen
          backLabel={STATUS_LABELS[status]}
          back={{ href: `/?status=${status}` }}
          title={categoryTitle(category)}
          count={items.length}
          initialView={view}
          onViewChange={saveItemView}
          partnerName={partner?.displayName ?? null}
          sort={
            withSort
              ? {
                  value: sort,
                  options: {
                    score: { href: categoryHref(category.id, status, "score") },
                    recent: { href: categoryHref(category.id, status) },
                  },
                }
              : null
          }
          average={withSort ? categoryScoreAverage(items) : null}
          // Itens novos entram em Queremos: o quadrado de adicionar só lá.
          add={{
            name: category.name,
            href: newItemHref(category.id),
            tile: status === "want",
          }}
          options={
            <AppCategoryOptions
              category={category}
              categories={categoriesResult.ok ? categoriesResult.categories : [category]}
              status={status}
              preview={{
                count: items.length,
                // Amostra do quadrado: os 2 mais novos, mesmo em "Melhor nota".
                sample: categorySampleText(
                  categoryItems(items, category, status)
                    .slice(0, 2)
                    .map((item) => item.title),
                  items.length,
                ),
              }}
            />
          }
          items={items}
          categoriesById={{ [category.id]: category }}
          memberNames={Object.fromEntries(
            space.members.map((member) => [member.userId, member.displayName]),
          )}
          memberOrder={space.members.map((member) => member.userId)}
        />
      </section>

      <Link href="/colar" className={FAB}>
        <span aria-hidden="true">＋</span>
        Colar link
      </Link>
    </main>
  );
}
