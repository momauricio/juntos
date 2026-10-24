import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";

import { Avatar, initial } from "@/components/avatar";
import { UrlItemFilters } from "@/components/item-filters";
import { ItemList, type ItemWithRatings } from "@/components/item-list";
import { WelcomeToast } from "@/components/welcome-toast";
import { spaceDisplayName } from "@/lib/invites";
import { STATUS_LABELS, TYPE_LABELS } from "@/lib/labels";
import { signInPathWithNext } from "@/lib/auth-callback";
import { loadMySpace } from "@/lib/space";
import { createClient } from "@/lib/supabase/server";
import type { ItemStatus, ItemType } from "@/lib/types";

export const metadata: Metadata = {
  title: "Lista",
};

const ITEM_TYPES = Object.keys(TYPE_LABELS) as ItemType[];
const ITEM_STATUSES = Object.keys(STATUS_LABELS).filter(
  (status) => status !== "all",
) as ItemStatus[];

type HomePageProps = {
  searchParams: Promise<{
    type?: string | string[];
    status?: string | string[];
    "bem-vindo"?: string | string[];
  }>;
};

function firstParam(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

function parseType(value: string | string[] | undefined): ItemType | "all" {
  const type = firstParam(value);
  return type && ITEM_TYPES.includes(type as ItemType)
    ? (type as ItemType)
    : "all";
}

function parseStatus(
  value: string | string[] | undefined,
): ItemStatus | "all" {
  const status = firstParam(value);
  return status && ITEM_STATUSES.includes(status as ItemStatus)
    ? (status as ItemStatus)
    : "all";
}

export default async function HomePage({ searchParams }: HomePageProps) {
  const params = await searchParams;
  const selectedType = parseType(params.type);
  const selectedStatus = parseStatus(params.status);

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

  if (selectedType !== "all") {
    query = query.eq("type", selectedType);
  }

  if (selectedStatus !== "all") {
    query = query.eq("status", selectedStatus);
  }

  const { data, error } = await query;

  if (error) {
    throw new Error("Não foi possível carregar a lista.");
  }

  const items = (data ?? []) as ItemWithRatings[];
  const memberDisplayNames = space.members.map((member) => member.displayName);
  const isWaiting = space.members.length < 2;
  // Nomes de quem divide o espaço: autoria das ideias e iniciais de quem deu nota.
  const memberNames: Record<string, string> = Object.fromEntries(
    space.members.map((member) => [member.userId, member.displayName]),
  );

  return (
    <main className="px-4 pb-24 pt-8 sm:pb-12">
      <section className="mx-auto w-full max-w-4xl space-y-6">
        <div className="flex items-start justify-between gap-4">
          <div className="space-y-2">
            <p className="text-sm font-semibold uppercase tracking-[0.3em] text-foreground/60">
              Juntos
            </p>
            <h1 className="font-serif text-4xl font-semibold tracking-tight text-foreground sm:text-5xl">
              {spaceDisplayName(space.name, memberDisplayNames)}
            </h1>
          </div>
          <div aria-hidden="true" className="flex -space-x-2 pt-6">
            {memberDisplayNames.map((name, index) => (
              <Avatar
                key={index}
                label={initial(name)}
                className="ring-2 ring-background"
              />
            ))}
            {isWaiting ? (
              <Avatar label="?" dashed className="bg-background" />
            ) : null}
          </div>
        </div>

        {isWaiting ? (
          <p className="flex flex-wrap items-center justify-between gap-2 rounded-3xl border border-accent/50 bg-accent/15 px-5 py-4 text-lg">
            <span>
              <span aria-hidden="true">⏳</span> Esperando seu par entrar
            </span>
            <Link
              href="/onboarding/convite"
              className="font-semibold text-accent-soft underline underline-offset-4"
            >
              Reenviar convite
            </Link>
          </p>
        ) : null}

        <UrlItemFilters type={selectedType} status={selectedStatus} />

        <ItemList items={items} memberNames={memberNames} />
      </section>

      {firstParam(params["bem-vindo"]) === "1" ? <WelcomeToast /> : null}
    </main>
  );
}
