import Link from "next/link";

import { STATUS_LABELS, TYPE_LABELS } from "@/lib/labels";
import { displayRating } from "@/lib/ratings";
import type { Item, Rating } from "@/lib/types";

export type ItemWithRatings = Item & {
  ratings: Rating[] | null;
};

type ItemListProps = {
  items: ItemWithRatings[];
};

function ratingLabel(rating: Rating) {
  const value = displayRating(rating);

  if (value == null) {
    return null;
  }

  return `Nota ${value.toLocaleString("pt-BR", {
    maximumFractionDigits: 1,
    minimumFractionDigits: 0,
  })}`;
}

export function ItemList({ items }: ItemListProps) {
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
        const rating = item.ratings?.[0];
        const ratingText = rating ? ratingLabel(rating) : null;

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
              </div>
              <span className="shrink-0 rounded-2xl bg-accent-soft px-3 py-1 text-xs font-semibold text-accent-strong">
                {STATUS_LABELS[item.status]}
              </span>
            </div>

            {ratingText ? (
              <p className="mt-4 text-sm font-medium text-foreground/75">
                {ratingText}
              </p>
            ) : null}
          </Link>
        );
      })}
    </div>
  );
}
