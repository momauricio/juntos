import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";

import { CategoryHome } from "@/components/category-home";
import { UrlStatusTabs } from "@/components/item-filters";
import type { ItemWithRatings } from "@/components/item-list";
import { SavedToast } from "@/components/saved-toast";
import { SpaceHeader } from "@/components/space-header";
import { FAB } from "@/components/ui-classes";
import { WelcomeToast } from "@/components/welcome-toast";
import { parseSavedStatus } from "@/lib/capture-link";
import { legacyTypeRedirect } from "@/lib/categories";
import { listCategories } from "@/lib/categories-data";
import { spaceDisplayName } from "@/lib/invites";
import { countByStatus } from "@/lib/item-categories";
import { typeLabel } from "@/lib/labels";
import { signInPathWithNext } from "@/lib/auth-callback";
import { loadMySpace } from "@/lib/space";
import { createClient } from "@/lib/supabase/server";
import type { ItemStatus } from "@/lib/types";

export const metadata: Metadata = {
  title: "Lista",
};

type HomePageProps = {
  searchParams: Promise<{
    type?: string | string[];
    status?: string | string[];
    "bem-vindo"?: string | string[];
    salvo?: string | string[];
    novo?: string | string[];
  }>;
};

function firstParam(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

// Sem aba "Todos": o padrão é "Queremos", exceto logo após salvar em
// "Já fizemos" (?salvo=done), para a aba bater com o toast.
function parseStatus(
  value: string | string[] | undefined,
  saved: ItemStatus | null,
): ItemStatus {
  const status = firstParam(value);

  if (status === "want" || status === "done") {
    return status;
  }

  return saved === "done" ? "done" : "want";
}

export default async function HomePage({ searchParams }: HomePageProps) {
  const params = await searchParams;
  const saved = parseSavedStatus(params.salvo);
  const selectedStatus = parseStatus(params.status, saved);

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect(signInPathWithNext(null));
  }

  const space = await loadMySpace(supabase, user.id);

  if (!space) {
    redirect("/onboarding");
  }

  // Itens e categorias juntos (uma consulta a mais que antes).
  const [itemsResult, categoriesResult] = await Promise.all([
    supabase
      .from("items")
      .select("*, ratings(*)")
      .eq("space_id", space.id)
      .order("created_at", { ascending: false }),
    listCategories(supabase, space.id),
  ]);

  if (itemsResult.error || !categoriesResult.ok) {
    throw new Error("Não foi possível carregar a lista.");
  }

  const categories = categoriesResult.categories;

  // Links antigos /?type=… vão para a categoria padrão do tipo (C15).
  const legacyTarget = legacyTypeRedirect(params.type, params.status, categories);
  if (legacyTarget) {
    redirect(legacyTarget);
  }

  // O status é filtrado na tela (e não na consulta) para as abas e a busca.
  const items = (itemsResult.data ?? []) as ItemWithRatings[];
  const counts = countByStatus(items);
  // Item recém-salvo (?salvo=want&novo=<id>): linha do toast.
  const newItemId = saved === "want" ? firstParam(params.novo) : undefined;
  const newItem = newItemId
    ? items.find((item) => item.id === newItemId)
    : undefined;
  const newItemCategory = newItem
    ? categories.find((category) => category.id === newItem.category_id)
    : undefined;
  const memberDisplayNames = space.members.map((member) => member.displayName);
  const isWaiting = space.members.length < 2;
  // Nomes de quem divide o espaço: bolinha com a inicial de quem adicionou.
  const memberNames: Record<string, string> = Object.fromEntries(
    space.members.map((member) => [member.userId, member.displayName]),
  );

  return (
    <main className="px-5 pb-28 pt-1">
      <section className="mx-auto w-full max-w-lg space-y-3.5">
        <SpaceHeader
          name={spaceDisplayName(space.name, memberDisplayNames)}
          memberNames={memberDisplayNames}
          waiting={isWaiting}
        />

        {isWaiting ? (
          <p className="flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-accent/50 bg-accent/[0.18] px-3 py-2.5">
            <span className="text-[14.5px] font-semibold text-cream">
              <span aria-hidden="true">⏳</span> Esperando seu par entrar
            </span>
            <Link
              href="/onboarding/convite"
              className="text-sm font-bold text-[#f0b8a4] underline underline-offset-2"
            >
              Reenviar convite
            </Link>
          </p>
        ) : null}

        <UrlStatusTabs status={selectedStatus} counts={counts} />

        <CategoryHome
          categories={categories}
          items={items}
          status={selectedStatus}
          memberNames={memberNames}
          memberOrder={space.members.map((member) => member.userId)}
        />
      </section>

      <Link
        href="/colar"
        className={FAB}
      >
        <span aria-hidden="true">＋</span>
        Colar link
      </Link>

      {firstParam(params["bem-vindo"]) === "1" ? <WelcomeToast /> : null}
      {saved ? (
        <SavedToast
          status={saved}
          description={
            newItem
              ? `${newItem.title} · ${newItemCategory?.name ?? typeLabel(newItem.type)}`
              : undefined
          }
        />
      ) : null}
    </main>
  );
}
