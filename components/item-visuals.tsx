import type { ReactNode } from "react";

import { Avatar, initial } from "@/components/avatar";
import { CARD } from "@/components/ui-classes";
import { TYPE_EMOJI, TYPE_LABELS } from "@/lib/labels";
import { formatScore } from "@/lib/ratings";
import type { Item, ItemType } from "@/lib/types";

type Tone = "terracotta" | "sage";

// Gradiente placeholder por tipo (os itens ainda não têm imagem própria).
const TYPE_GRADIENT: Record<ItemType, string> = {
  food_idea: "ph1",
  tourist_spot: "ph2",
  restaurant: "ph3",
  city: "ph4",
  movie: "ph2",
  event: "ph1",
};

// Classe .ph1–.ph4 do tipo (tipos desconhecidos caem na primeira).
export function typeGradient(type: string) {
  return TYPE_GRADIENT[type as ItemType] ?? "ph1";
}

// "São Paulo · Restaurante" quando há lugar; senão só o tipo.
export function itemSubtitle(type: ItemType, place?: string | null) {
  const trimmed = place?.trim();
  return trimmed ? `${trimmed} · ${TYPE_LABELS[type]}` : TYPE_LABELS[type];
}

export function ItemPhoto({
  type,
  variant = "thumb",
  children,
}: {
  type: ItemType;
  variant?: "thumb" | "hero";
  children?: ReactNode;
}) {
  return (
    <div
      className={`relative flex shrink-0 items-center justify-center overflow-hidden ${TYPE_GRADIENT[type]} ${
        variant === "hero"
          ? "h-[150px] w-full rounded-[20px] text-[64px]"
          : "h-16 w-16 rounded-2xl text-[28px]"
      }`}
    >
      <span aria-hidden="true">{TYPE_EMOJI[type]}</span>
      {children}
    </div>
  );
}

export const ITEM_CARD_CLASS =
  "flex w-full items-center gap-3 rounded-[22px] bg-surface p-2.5 text-left text-ink shadow-[0_10px_24px_rgba(0,0,0,0.18)] transition hover:-translate-y-0.5";

// Miolo do cartão do quadro (mockup .item); o wrapper (Link/botão) fica com quem usa.
export function ItemCardContent({
  item,
  subtitle,
  author,
  addedLabel,
  score,
}: {
  item: Pick<Item, "type" | "title">;
  subtitle: string;
  author: { name: string; tone: Tone };
  addedLabel: string;
  score?: number | null;
}) {
  return (
    <>
      <ItemPhoto type={item.type} />
      <div className="min-w-0 flex-1">
        <p className="truncate text-base font-bold">{item.title}</p>
        <p className="truncate text-[13px] text-ink/60">{subtitle}</p>
        <p className="mt-1 flex items-center gap-1.5 text-[12.5px] text-ink/60">
          <Avatar
            label={initial(author.name)}
            size="xs"
            tone={author.tone}
          />
          <span className="truncate">{addedLabel}</span>
        </p>
      </div>
      {score != null ? (
        <span className="mr-1 shrink-0 self-start rounded-[10px] bg-accent-soft px-2.5 py-0.5 text-sm font-bold">
          {formatScore(score)}
        </span>
      ) : null}
    </>
  );
}

// Cabeçalho do detalhe: foto grande, selo "Já fizemos · dd/mm", título e subtítulo.
export function ItemHero({
  type,
  title,
  subtitle,
  badge,
  children,
}: {
  type: ItemType;
  title: string;
  subtitle: string;
  badge?: string | null;
  children?: ReactNode;
}) {
  return (
    <div>
      <ItemPhoto type={type} variant="hero">
        {badge ? (
          <span className="absolute left-3 top-3 rounded-full bg-cream px-2.5 py-1 text-[12.5px] font-bold text-ink">
            {badge}
          </span>
        ) : null}
      </ItemPhoto>
      <h1 className="mt-3.5 text-[28px] font-medium leading-tight text-cream">
        {title}
      </h1>
      <p className="text-sm text-cream/70">{subtitle}</p>
      {children}
    </div>
  );
}

export type CouplePerson = {
  id: string;
  name: string;
  tone: Tone;
  average: number | null;
  chips: string[];
  comment: string | null;
  emptyText?: string;
};

// Card creme "Nota do casal" com a média grande e uma seção por pessoa.
export function CoupleScoreCard({
  couple,
  caption,
  people,
  emptyText,
}: {
  couple: number | null;
  caption: string;
  people: CouplePerson[];
  emptyText: string;
}) {
  return (
    <div className={`${CARD} p-4`}>
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.08em] text-ink/65">
            Nota do casal
          </p>
          {couple != null ? (
            <p className="text-[13px] text-ink/65">{caption}</p>
          ) : null}
        </div>
        {couple != null ? (
          <p className="font-serif text-[44px] font-semibold leading-none text-accent">
            {formatScore(couple)}
          </p>
        ) : null}
      </div>

      {couple != null ? (
        <ul>
          {people.map((person) => (
            <li
              key={person.id}
              className="mt-3 border-t border-ink/10 pt-3"
            >
              <div className="flex items-center justify-between gap-3">
                <span className="flex items-center gap-2">
                  <Avatar
                    label={initial(person.name)}
                    size="xs"
                    tone={person.tone}
                  />
                  <b>{person.name}</b>
                </span>
                {person.average != null ? (
                  <span className="rounded-[10px] bg-accent-soft px-2.5 py-0.5 font-bold">
                    {formatScore(person.average)}
                  </span>
                ) : null}
              </div>
              {person.average != null ? (
                <>
                  {person.chips.length > 0 ? (
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      {person.chips.map((chip) => (
                        <ScoreChip key={chip} text={chip} />
                      ))}
                    </div>
                  ) : null}
                  {person.comment ? (
                    <p className="mt-2 text-sm italic text-ink/65">
                      “{person.comment}”
                    </p>
                  ) : null}
                </>
              ) : (
                <p className="mt-2 text-sm text-ink/65">
                  {person.emptyText ?? `${person.name} ainda não deu nota`}
                </p>
              )}
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-2 text-sm leading-6 text-ink/70">{emptyText}</p>
      )}
    </div>
  );
}

// "Comida 9" → chip com o número em negrito.
function ScoreChip({ text }: { text: string }) {
  const match = text.match(/^(.*\S)\s+(\d+)$/);

  return (
    <span className="inline-flex h-7 items-center gap-1.5 whitespace-nowrap rounded-full bg-ink/[0.07] px-2.5 text-[13px] font-semibold">
      {match ? (
        <>
          {match[1]} <b className="ml-0.5">{match[2]}</b>
        </>
      ) : (
        text
      )}
    </span>
  );
}

// Subnotas no formato do mockup: restaurante mostra as três; o resto, a nota única.
export function ratingChips(rating: {
  food: number | null;
  service: number | null;
  ambiance: number | null;
  score: number | null;
}) {
  if (
    rating.food != null &&
    rating.service != null &&
    rating.ambiance != null
  ) {
    return [
      `Comida ${rating.food}`,
      `Atendimento ${rating.service}`,
      `Ambiente ${rating.ambiance}`,
    ];
  }

  return rating.score != null ? [`Nota ${rating.score}`] : [];
}

export function formatDayMonth(timestamp: string) {
  return new Date(timestamp).toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    timeZone: "America/Sao_Paulo",
  });
}
