import type { ReactNode } from "react";

import { Avatar, initial } from "@/components/avatar";
import { BTN_OUTLINE, CARD } from "@/components/ui-classes";
import { originalLink } from "@/lib/capture-link";
import {
  ACTIVITY_NO_ADDRESS_COPY,
  STATUS_LABELS,
  TYPE_THUMB,
  typeEmoji,
  typeHint,
  typeLabel,
} from "@/lib/labels";
import { formatScore } from "@/lib/ratings";
import type { Item, ItemStatus, ItemType } from "@/lib/types";

type Tone = "terracotta" | "sage";

// Classe .ph1–.ph7 do tipo (tipos desconhecidos caem na primeira).
export function typeGradient(type: string) {
  return Object.hasOwn(TYPE_THUMB, type) ? TYPE_THUMB[type as ItemType] : "ph1";
}

// "São Paulo · Restaurante" quando há lugar; senão só o tipo.
export function itemSubtitle(type: ItemType, place?: string | null) {
  const trimmed = place?.trim();
  return trimmed ? `${trimmed} · ${typeLabel(type)}` : typeLabel(type);
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
      className={`relative flex shrink-0 items-center justify-center overflow-hidden ${typeGradient(type)} ${
        variant === "hero"
          ? "h-[150px] w-full rounded-[20px] text-[64px]"
          : "h-16 w-16 rounded-2xl text-[28px]"
      }`}
    >
      <span aria-hidden="true">{typeEmoji(type)}</span>
      {children}
    </div>
  );
}

// Caixa com o tipo escolhido e o hint dele (mockup 20).
export function TypeHintBox({ type }: { type: ItemType }) {
  return (
    <div className="flex items-start gap-2.5 rounded-[14px] bg-accent-soft px-3 py-2.5 text-[14.5px] text-ink">
      <span aria-hidden="true" className="text-xl leading-6">
        {typeEmoji(type)}
      </span>
      <p>
        <b>{typeLabel(type)}</b>
        <br />
        {typeHint(type)}
      </p>
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

// Selo da foto do detalhe: "💛 Queremos" ou "✓ Já fizemos · dd/mm".
export function heroBadge(item: {
  status: ItemStatus;
  completed_at: string | null;
}) {
  if (item.status === "want") {
    return `💛 ${STATUS_LABELS.want}`;
  }

  return item.completed_at
    ? `✓ ${STATUS_LABELS.done} · ${formatDayMonth(item.completed_at)}`
    : `✓ ${STATUS_LABELS.done}`;
}

// Linha do detalhe (mockup 22): "🧺 Programa · Lucas adicionou · ontem".
export function heroSubtitle(type: ItemType, addedLabel: string) {
  return `${heroTypeLabel(type)} · ${addedLabel}`;
}

// "🧺 Programa" (começo da linha do detalhe).
export function heroTypeLabel(type: ItemType) {
  return `${typeEmoji(type)} ${typeLabel(type)}`;
}

const SECTION_LABEL =
  "text-xs font-bold uppercase tracking-[0.08em] text-ink/65";

// Card só-leitura do detalhe (mockup 22): notas e link original, cada um só se houver.
export function ItemNotesCard({
  item,
}: {
  item: { notes: string | null; url: string | null };
}) {
  const notes = item.notes?.trim();
  const link = originalLink(item.url);

  if (!notes && !link) {
    return null;
  }

  return (
    <div className={`${CARD} px-4 py-3.5`}>
      {notes ? (
        <>
          <p className={SECTION_LABEL}>Notas</p>
          <p className="mt-1 whitespace-pre-line break-words text-[15.5px] leading-normal">
            {notes}
          </p>
        </>
      ) : null}
      {notes && link ? (
        <div aria-hidden="true" className="my-3 h-px bg-ink/10" />
      ) : null}
      {link ? (
        <>
          <p className={SECTION_LABEL}>Link original</p>
          {link.href ? (
            <a
              href={link.href}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-1 flex items-center justify-between gap-3 text-[15px] font-semibold hover:underline"
            >
              <span className="min-w-0 break-all">{link.label}</span>
              <span aria-hidden="true" className="shrink-0 font-bold text-accent">
                ↗
              </span>
              <span className="sr-only"> (abre em nova aba)</span>
            </a>
          ) : (
            <p className="mt-1 break-all text-[15px] font-semibold">
              {link.label}
            </p>
          )}
        </>
      ) : null}
    </div>
  );
}

// "✎ Editar" do detalhe: o formulário de edição fica fechado até a pessoa abrir.
export function EditDisclosure({ children }: { children: ReactNode }) {
  return (
    <details className="space-y-3">
      <summary
        className={`${BTN_OUTLINE} cursor-pointer list-none [&::-webkit-details-marker]:hidden`}
      >
        ✎ Editar
      </summary>
      {children}
    </details>
  );
}

// Programa sem notas: lembra que onde/quando vão nas notas.
export function ActivityNoAddressNote({
  item,
}: {
  item: { type: ItemType; notes: string | null };
}) {
  if (item.type !== "activity" || item.notes?.trim()) {
    return null;
  }

  return (
    <p className="text-center text-[13.5px] text-cream/60">
      {ACTIVITY_NO_ADDRESS_COPY}
    </p>
  );
}

// Cabeçalho do detalhe: foto grande, selo de status, título e subtítulo.
export function ItemHero({
  type,
  title,
  subtitle,
  badge,
  author,
  children,
}: {
  type: ItemType;
  title: string;
  subtitle: string;
  badge?: string | null;
  // Com autor, a bolinha com a inicial entra antes de "Lucas adicionou".
  author?: { name: string; tone: Tone; addedLabel: string };
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
      {author ? (
        <p className="flex flex-wrap items-center gap-x-1.5 text-sm text-cream/70">
          <span>{subtitle} ·</span>
          <span className="flex items-center gap-1.5">
            <Avatar
              label={initial(author.name)}
              size="xs"
              tone={author.tone}
            />
            {author.addedLabel}
          </span>
        </p>
      ) : (
        <p className="text-sm text-cream/70">{subtitle}</p>
      )}
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
