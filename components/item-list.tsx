import Link from "next/link";

import { STATUS_LABELS, TYPE_LABELS } from "@/lib/labels";
import { coupleScore, formatScore } from "@/lib/ratings";
import { addedByLabel, UNKNOWN_AUTHOR_NAME } from "@/lib/relative-time";
import type { Item, Rating } from "@/lib/types";

export type ItemWithRatings = Item & {
  ratings: Rating[] | null;
};

type ItemListProps = {
  items: ItemWithRatings[];
  memberNames: Record<string, string>;
};

export function ItemList({ items, memberNames }: ItemListProps) {
  if (items.length === 0) {
    return (
      <div className="rounded-3xl bg-surface px-6 py-12 text-center ring-1 ring-border">
        <h2 className="font-serif text-2xl font-semibold tracking-tight">
          Nenhuma ideia ainda
        </h2>
        <p className="mt-3 text-sm leading-6 text-foreground/70">
          Adicionem restaurantes, filmes, viagens e outras vontades para fazer
          juntos.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {items.map((item) => {
        const ratings = item.ratings ?? [];
        const couple = coupleScore(ratings);

        return (
          <Link
            key={item.id}
            href={`/items/${item.id}`}
            className="block rounded-3xl bg-surface p-5 ring-1 ring-border transition hover:-translate-y-0.5 hover:ring-accent"
          >
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 className="font-serif text-xl font-semibold tracking-tight text-foreground">
                  {item.title}
                </h2>
                <p className="mt-2 text-sm text-foreground/65">
                  {TYPE_LABELS[item.type]}
                </p>
                <p className="mt-1 text-xs text-foreground/60">
                  {addedByLabel(
                    memberNames[item.created_by] ?? UNKNOWN_AUTHOR_NAME,
                    item.created_at,
                  )}
                </p>
              </div>
              <span className="shrink-0 rounded-2xl bg-accent-soft px-3 py-1 text-xs font-semibold text-accent-strong">
                {STATUS_LABELS[item.status]}
              </span>
            </div>

            {couple != null ? (
              <div className="mt-4 flex items-center gap-3">
                <p className="text-sm font-medium text-foreground/75">
                  Nota do casal {formatScore(couple)}
                </p>
                <div className="flex -space-x-1.5">
                  {ratings.map((rating) => {
                    const name = memberNames[rating.rated_by];

                    return (
                      <span
                        key={rating.id}
                        title={name}
                        className="flex size-6 items-center justify-center rounded-full bg-accent text-[11px] font-semibold text-accent-contrast ring-2 ring-surface"
                      >
                        {name ? name.charAt(0).toUpperCase() : "?"}
                      </span>
                    );
                  })}
                </div>
              </div>
            ) : null}
          </Link>
        );
      })}
    </div>
  );
}
