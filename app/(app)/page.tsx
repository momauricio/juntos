import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";

import { Avatar, initial, memberTone } from "@/components/avatar";
import { TypeFilterFooter, UrlItemFilters } from "@/components/item-filters";
import { ItemList, type ItemWithRatings } from "@/components/item-list";
import { SavedToast } from "@/components/saved-toast";
import { FAB } from "@/components/ui-classes";
import { WelcomeToast } from "@/components/welcome-toast";
import { parseSavedStatus } from "@/lib/capture-link";
import { spaceDisplayName } from "@/lib/invites";
import {
  countByStatus,
  parseTypeParam,
  typeFilterSummary,
} from "@/lib/item-categories";
import { TYPE_LABELS } from "@/lib/labels";
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
  const typeFilter = parseTypeParam(params.type);
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

  let query = supabase
    .from("items")
    .select("*, ratings(*)")
    .eq("space_id", space.id)
    .order("created_at", { ascending: false });

  if (typeFilter.types) {
    query = query.in("type", typeFilter.types);
  }

  const { data, error } = await query;

  if (error) {
    throw new Error("Não foi possível carregar a lista.");
  }

  // O status é filtrado aqui (e não na consulta) para as abas mostrarem a contagem.
  const typeItems = (data ?? []) as ItemWithRatings[];
  const items = typeItems.filter((item) => item.status === selectedStatus);
  const counts = countByStatus(typeItems);
  // Item recém-salvo (?salvo=want&novo=<id>): destaque na lista e linha do toast.
  const newItemId = saved === "want" ? firstParam(params.novo) : undefined;
  const newItem = newItemId
    ? typeItems.find((item) => item.id === newItemId)
    : undefined;
  const memberDisplayNames = space.members.map((member) => member.displayName);
  const isWaiting = space.members.length < 2;
  // Nomes de quem divide o espaço: autoria das ideias e iniciais de quem deu nota.
  const memberNames: Record<string, string> = Object.fromEntries(
    space.members.map((member) => [member.userId, member.displayName]),
  );

  return (
    <main className="px-5 pb-28 pt-1">
      <section className="mx-auto w-full max-w-lg space-y-3.5">
        <div className="flex items-center justify-between gap-4">
          <div className="min-w-0">
            <p className="text-xs font-semibold uppercase tracking-[0.24em] text-cream/60">
              Juntos
            </p>
            <h1 className="mt-1 text-[28px] font-medium leading-tight text-cream">
              {spaceDisplayName(space.name, memberDisplayNames)}
            </h1>
          </div>
          <div aria-hidden="true" className="flex shrink-0 -space-x-2">
            {memberDisplayNames.map((name, index) => (
              <Avatar
                key={index}
                label={initial(name)}
                size="md"
                tone={memberTone(index)}
              />
            ))}
            {isWaiting ? (
              <Avatar label="?" size="md" dashed className="bg-background" />
            ) : null}
          </div>
        </div>

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

        <UrlItemFilters
          typeChip={typeFilter.chip}
          status={selectedStatus}
          counts={counts}
        />

        <ItemList
          items={items}
          memberNames={memberNames}
          memberOrder={space.members.map((member) => member.userId)}
          highlightId={newItem?.id}
        />

        {typeFilter.chip && typeFilter.chip !== "all" ? (
          <TypeFilterFooter
            summary={typeFilterSummary(
              typeFilter.chip,
              counts[selectedStatus],
              selectedStatus,
            )}
            href={`/?status=${selectedStatus}`}
          />
        ) : null}
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
            newItem ? `${newItem.title} · ${TYPE_LABELS[newItem.type]}` : undefined
          }
        />
      ) : null}
    </main>
  );
}
