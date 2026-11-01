import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";

import { ItemList, ListScreenHeader, type ItemWithRatings } from "@/components/item-list";
import { FAB } from "@/components/ui-classes";
import { signInPathWithNext } from "@/lib/auth-callback";
import { HOME_COPY, LIST_COPY, RECENT_LIMIT } from "@/lib/categories";
import { listCategories } from "@/lib/categories-data";
import { STATUS_LABELS } from "@/lib/labels";
import { loadMySpace } from "@/lib/space";
import { createClient } from "@/lib/supabase/server";
import type { ItemStatus } from "@/lib/types";

export const metadata: Metadata = {
  title: HOME_COPY.recentTitle,
};

type RecentPageProps = {
  searchParams: Promise<{ status?: string | string[] }>;
};

function parseStatus(value: string | string[] | undefined): ItemStatus {
  const status = Array.isArray(value) ? value[0] : value;
  return status === "done" ? "done" : "want";
}

// Os 10 mais novos da aba, de todas as categorias (C8). Neste PR sai só em
// Compacta; o seletor Grade/Compacta (profiles.item_view) entra no PR 5.
export default async function RecentPage({ searchParams }: RecentPageProps) {
  const status = parseStatus((await searchParams).status);
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect(signInPathWithNext(`/recentes?status=${status}`));
  }

  const space = await loadMySpace(supabase, user.id);

  if (!space) {
    redirect("/onboarding");
  }

  // created_at desc + limit já dá os 10 mais novos (mesma regra de recentItems).
  const [itemsResult, categoriesResult] = await Promise.all([
    supabase
      .from("items")
      .select("*, ratings(*)")
      .eq("space_id", space.id)
      .eq("status", status)
      .order("created_at", { ascending: false })
      .order("id", { ascending: true })
      .limit(RECENT_LIMIT),
    listCategories(supabase, space.id),
  ]);

  if (itemsResult.error || !categoriesResult.ok) {
    throw new Error("Não foi possível carregar a lista.");
  }

  const items = (itemsResult.data ?? []) as ItemWithRatings[];
  const categoriesById = Object.fromEntries(
    categoriesResult.categories.map((category) => [category.id, category]),
  );

  return (
    <main className="px-5 pb-28 pt-1">
      <section className="mx-auto w-full max-w-lg space-y-3.5">
        <ListScreenHeader
          backLabel={STATUS_LABELS[status]}
          backHref={`/?status=${status}`}
          title={LIST_COPY.recentScreenTitle}
          subtitle={LIST_COPY.newestFirst}
        />

        {items.length === 0 ? (
          <p className="py-6 text-center text-[15px] text-cream/70">
            {LIST_COPY.empty}
          </p>
        ) : (
          <ItemList
            items={items}
            categoriesById={categoriesById}
            memberNames={Object.fromEntries(
              space.members.map((member) => [member.userId, member.displayName]),
            )}
            memberOrder={space.members.map((member) => member.userId)}
          />
        )}
      </section>

      <Link href="/colar" className={FAB}>
        <span aria-hidden="true">＋</span>
        Colar link
      </Link>
    </main>
  );
}
