import Link from "next/link";

import { memberTone } from "@/components/avatar";
import {
  ITEM_CARD_CLASS,
  ItemCardContent,
  itemSubtitle,
} from "@/components/item-visuals";
import { CARD } from "@/components/ui-classes";
import { coupleScore } from "@/lib/ratings";
import { addedByLabel, UNKNOWN_AUTHOR_NAME } from "@/lib/relative-time";
import type { Item, Rating } from "@/lib/types";

export type ItemWithRatings = Item & {
  ratings: Rating[] | null;
};

type ItemListProps = {
  items: ItemWithRatings[];
  memberNames: Record<string, string>;
  // userIds na ordem de entrada no espaço (define a cor do avatar).
  memberOrder?: string[];
  // Item recém-salvo, com contorno terracota (mockup 23).
  highlightId?: string;
};

export function ItemList({
  items,
  memberNames,
  memberOrder = [],
  highlightId,
}: ItemListProps) {
  if (items.length === 0) {
    return (
      <div className={`${CARD} px-6 py-12 text-center`}>
        <h2 className="font-serif text-2xl font-semibold tracking-tight">
          Nenhuma ideia ainda
        </h2>
        <p className="mt-3 text-sm leading-6 text-ink/70">
          Adicionem restaurantes, programas, filmes e outras vontades para
          fazer juntos.
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-2.5">
      {items.map((item) => {
        const authorName = memberNames[item.created_by] ?? UNKNOWN_AUTHOR_NAME;

        return (
          <Link
            key={item.id}
            href={`/items/${item.id}`}
            className={`${ITEM_CARD_CLASS} ${
              item.id === highlightId
                ? "outline-2 outline-offset-2 outline-accent"
                : ""
            }`}
          >
            <ItemCardContent
              item={item}
              subtitle={itemSubtitle(item.type)}
              author={{
                name: authorName,
                tone: memberTone(memberOrder.indexOf(item.created_by)),
              }}
              addedLabel={addedByLabel(authorName, item.created_at)}
              score={coupleScore(item.ratings ?? [])}
            />
          </Link>
        );
      })}
    </div>
  );
}
