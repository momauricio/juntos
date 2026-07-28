import { redirect } from "next/navigation";

import { UrlItemFilters } from "@/components/item-filters";
import { ItemList, type ItemWithRatings } from "@/components/item-list";
import { STATUS_LABELS, TYPE_LABELS } from "@/lib/labels";
import { createClient } from "@/lib/supabase/server";
import type { ItemStatus, ItemType } from "@/lib/types";

const ITEM_TYPES = Object.keys(TYPE_LABELS) as ItemType[];
const ITEM_STATUSES = Object.keys(STATUS_LABELS).filter(
  (status) => status !== "all",
) as ItemStatus[];

type HomePageProps = {
  searchParams: Promise<{
    type?: string | string[];
    status?: string | string[];
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

  let query = supabase
    .from("items")
    .select("*, ratings(*)")
    .eq("space_id", membership.space_id)
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

  return (
    <main className="px-4 pb-24 pt-8 sm:pb-12">
      <section className="mx-auto w-full max-w-4xl space-y-6">
        <div className="space-y-3">
          <p className="text-sm font-semibold uppercase tracking-[0.18em] text-accent">
            Lista
          </p>
          <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <h1 className="font-serif text-4xl font-semibold tracking-tight text-foreground sm:text-5xl">
                Ideias para vocês
              </h1>
              <p className="mt-3 max-w-2xl text-base leading-7 text-foreground/70">
                Filtre a lista compartilhada por tipo ou status e mantenha os
                próximos planos fáceis de encontrar.
              </p>
            </div>
          </div>
        </div>

        <UrlItemFilters type={selectedType} status={selectedStatus} />

        <ItemList items={items} />
      </section>
    </main>
  );
}
