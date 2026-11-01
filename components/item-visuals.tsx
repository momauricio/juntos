import Link from "next/link";
import type { ReactNode } from "react";

import { Avatar, initial } from "@/components/avatar";
import { BTN_OUTLINE, CARD } from "@/components/ui-classes";
import { originalLink } from "@/lib/capture-link";
import { GRID_COPY, SCORE_BAND_COLORS, scoreBand } from "@/lib/categories";
import {
  ACTIVITY_NO_ADDRESS_COPY,
  STATUS_LABELS,
  TYPE_THUMB,
  typeEmoji,
  typeHint,
  typeLabel,
} from "@/lib/labels";
import { formatScore } from "@/lib/ratings";
import type { Category, Item, ItemStatus, ItemType } from "@/lib/types";

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
  category,
  variant = "thumb",
  children,
}: {
  type: ItemType;
  // Com categoria, a cor e o emoji são os dela (não os do tipo).
  category?: CategoryLook | null;
  variant?: "thumb" | "hero";
  children?: ReactNode;
}) {
  return (
    <div
      className={`relative flex shrink-0 items-center justify-center overflow-hidden ${category?.color ?? typeGradient(type)} ${
        variant === "hero"
          ? "h-[150px] w-full rounded-[20px] text-[64px]"
          : "h-16 w-16 rounded-2xl text-[28px]"
      }`}
    >
      <span aria-hidden="true">{category?.emoji ?? typeEmoji(type)}</span>
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

// Cor (.ph1–.ph8) e emoji da categoria, no lugar do tipo (C14).
export type CategoryLook = Pick<Category, "emoji" | "color">;

// Link (app) ou botão (demo) com o mesmo visual.
export function Pressable({
  href,
  onClick,
  className,
  children,
  ...aria
}: {
  href?: string;
  onClick?: () => void;
  className?: string;
  children: ReactNode;
  "aria-label"?: string;
  "aria-current"?: boolean | "page" | "true";
}) {
  if (onClick || !href) {
    return (
      <button type="button" onClick={onClick} className={className} {...aria}>
        {children}
      </button>
    );
  }

  return (
    <Link href={href} className={className} {...aria}>
      {children}
    </Link>
  );
}

// Selo da nota (.bd): cor pela faixa (verde/azul/laranja/vermelho).
export function ScoreBadge({
  value,
  className = "w-[42px] rounded-[9px] py-[3px] text-sm",
}: {
  value: number;
  className?: string;
}) {
  return (
    <span
      className={`inline-flex shrink-0 items-center justify-center whitespace-nowrap font-bold text-white ${className}`}
      style={{ background: SCORE_BAND_COLORS[scoreBand(value)] }}
    >
      {formatScore(value)}
    </span>
  );
}

type CardAuthor = { name: string; tone: Tone };

function AuthorDot({
  author,
  className = "",
}: {
  author: CardAuthor;
  className?: string;
}) {
  return (
    <>
      <Avatar
        label={initial(author.name)}
        size="xs"
        tone={author.tone}
        className={className}
      />
      <span className="sr-only">, de {author.name}</span>
    </>
  );
}

// Foto do link no card da Grade, com o selo "📸 Instagram"/"📸 link".
export type GridImage = { url: string; source: "instagram" | "link" };

export type ItemCardProps = {
  item: Pick<Item, "title" | "city">;
  category: CategoryLook;
  author: CardAuthor;
  // Só em Já fizemos e com nota.
  score?: number | null;
  href?: string;
  onClick?: () => void;
};

// Linha da Compacta (mockups 42/53): ícone da categoria, nome · cidade, selo, bolinha.
export function ItemCompactRow({
  item,
  category,
  author,
  score,
  statusBadge,
  href,
  onClick,
}: ItemCardProps & {
  // Busca (as duas abas juntas): "💛 Queremos" / "✓ Já fizemos".
  statusBadge?: string;
}) {
  const city = item.city?.trim();

  return (
    <Pressable
      href={href}
      onClick={onClick}
      className="flex min-h-11 w-full items-center gap-2.5 border-t border-ink/[0.08] px-3 py-2 text-left text-ink transition hover:bg-ink/[0.03]"
    >
      <span
        aria-hidden="true"
        className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-[9px] text-[15px] ${category.color}`}
      >
        {category.emoji}
      </span>
      {statusBadge ? (
        // Busca: o nome fica com a linha toda; o selo e a cidade descem para
        // uma 2ª linha pequena (no celular, o selo ao lado cortava o nome).
        <span className="flex min-w-0 flex-1 flex-col">
          <span className="truncate text-[15.5px] font-bold leading-tight">
            {item.title}
          </span>
          <span className="mt-0.5 flex min-w-0 items-center gap-1.5 text-[12.5px] leading-tight">
            <span className="shrink-0 whitespace-nowrap rounded-full bg-ink/[0.07] px-1.5 py-px font-semibold text-ink/75">
              {statusBadge}
            </span>
            {city ? <span className="truncate text-ink/60">{city}</span> : null}
          </span>
        </span>
      ) : (
        <span className="min-w-0 flex-1 truncate text-[15.5px] font-bold">
          {item.title}
          {city ? (
            <span className="text-sm font-normal text-ink/60"> · {city}</span>
          ) : null}
        </span>
      )}
      {score != null ? <ScoreBadge value={score} /> : null}
      <AuthorDot author={author} />
    </Pressable>
  );
}

// Card quadrado da Grade (mockups 41/52): foto do link quando houver, senão
// cor + emoji da categoria; nome e cidade embaixo, bolinha no canto.
export function ItemGridTile({
  item,
  category,
  author,
  score,
  image,
  href,
  onClick,
}: ItemCardProps & {
  // Imagem do link (os itens do app ainda não guardam; a demo tem algumas).
  image?: GridImage | null;
}) {
  const city = item.city?.trim();

  return (
    <Pressable
      href={href}
      onClick={onClick}
      className={`relative block aspect-square w-full overflow-hidden rounded-[22px] text-left shadow-[0_10px_24px_rgba(0,0,0,0.25)] transition hover:-translate-y-0.5 ${
        image ? "bg-cover bg-center" : category.color
      }`}
    >
      {image ? (
        <>
          <span
            aria-hidden="true"
            className="absolute inset-0 bg-cover bg-center"
            style={{ backgroundImage: `url(${JSON.stringify(image.url)})` }}
          />
          <span
            aria-hidden="true"
            className="absolute inset-0 bg-[linear-gradient(180deg,transparent_40%,rgba(10,14,26,0.72))]"
          />
          <span className="absolute left-2.5 top-2.5 rounded-full bg-[rgba(10,14,26,0.45)] px-2 py-[3px] text-[11.5px] font-bold text-white">
            {image.source === "instagram"
              ? GRID_COPY.photoInstagram
              : GRID_COPY.photoLink}
          </span>
        </>
      ) : (
        <>
          <span
            aria-hidden="true"
            className="absolute inset-x-0 top-[22px] text-center text-[52px] leading-none"
          >
            {category.emoji}
          </span>
          <span
            aria-hidden="true"
            className="absolute inset-0 bg-[linear-gradient(180deg,transparent_55%,rgba(10,14,26,0.35))]"
          />
        </>
      )}
      {score != null && !image ? (
        <ScoreBadge
          value={score}
          className="absolute left-2.5 top-2.5 rounded-[9px] px-2 py-0.5 text-sm"
        />
      ) : null}
      <span className="absolute inset-x-3 bottom-[11px] text-white [text-shadow:0_1px_6px_rgba(0,0,0,0.35)]">
        <span className="line-clamp-3 block text-[17px] font-bold leading-[1.2]">
          {item.title}
        </span>
        {city ? (
          <span className="mt-px block truncate text-[13px] opacity-85">
            {city}
          </span>
        ) : null}
      </span>
      <span className="absolute right-2.5 top-2.5">
        <AuthorDot
          author={author}
          className="shadow-[0_0_0_2px_rgba(255,255,255,0.85)]"
        />
      </span>
    </Pressable>
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

// "🍝 Restaurante" (começo da linha do detalhe): a categoria do item; sem
// ela (não carregou), o tipo.
export function heroCategoryLabel(
  type: ItemType,
  category?: Pick<Category, "emoji" | "name"> | null,
) {
  return category
    ? `${category.emoji} ${category.name}`
    : `${typeEmoji(type)} ${typeLabel(type)}`;
}

// Linha do detalhe: "🧺 Programa · Lucas adicionou · ontem".
export function heroSubtitle(categoryLabel: string, addedLabel: string) {
  return `${categoryLabel} · ${addedLabel}`;
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
  category,
  title,
  subtitle,
  badge,
  author,
  children,
}: {
  type: ItemType;
  category?: CategoryLook | null;
  title: string;
  subtitle: string;
  badge?: string | null;
  // Com autor, a bolinha com a inicial entra antes de "Lucas adicionou".
  author?: { name: string; tone: Tone; addedLabel: string };
  children?: ReactNode;
}) {
  return (
    <div>
      <ItemPhoto type={type} category={category} variant="hero">
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

// "Comida 8,2" → chip com o número em negrito.
function ScoreChip({ text }: { text: string }) {
  const match = text.match(/^(.*\S)\s+(\d+(?:,\d)?)$/);

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
      `Comida ${formatScore(rating.food)}`,
      `Atendimento ${formatScore(rating.service)}`,
      `Ambiente ${formatScore(rating.ambiance)}`,
    ];
  }

  return rating.score != null ? [`Nota ${formatScore(rating.score)}`] : [];
}

export function formatDayMonth(timestamp: string) {
  return new Date(timestamp).toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    timeZone: "America/Sao_Paulo",
  });
}
