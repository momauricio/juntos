"use client";

import Link from "next/link";
import { type FormEvent, useActionState, useState } from "react";

import { useOnline } from "@/components/auth-hooks";
import { BackLink, OfflineBanner } from "@/components/auth-ui";
import { ItemPhoto, TypeHintBox } from "@/components/item-visuals";
import {
  BTN_PRIMARY,
  CARD,
  ERROR_TEXT,
  TEXT_LINK_QUIET,
  TEXTAREA,
} from "@/components/ui-classes";
import { PICK_TYPE_COPY } from "@/lib/capture-link";
import {
  NOTES_PLACEHOLDER,
  STATUS_LABELS,
  TYPE_EMOJI,
  TYPE_LABELS,
} from "@/lib/labels";
import type { ItemStatus, ItemType } from "@/lib/types";

export type PlaceReviewState = {
  error: string | null;
};

type PlaceReviewCardProps = {
  url: string;
  backHref: string;
  saveAction: (
    state: PlaceReviewState,
    formData: FormData,
  ) => Promise<PlaceReviewState>;
  // "＋ Colar link" pede "O que vocês querem guardar?"; o onboarding mantém o padrão.
  heading?: string;
};

const ITEM_TYPES = Object.keys(TYPE_LABELS) as ItemType[];
const STATUS_OPTIONS: { value: ItemStatus; label: string }[] = [
  { value: "want", label: `💛 ${STATUS_LABELS.want}` },
  { value: "done", label: `✓ ${STATUS_LABELS.done}` },
];
const INITIAL_STATE: PlaceReviewState = { error: null };

const FIELD_LABEL =
  "block text-xs font-bold uppercase tracking-[0.08em] text-ink/65";
// Mockup .chip / .chip.on; a altura de toque fica no <label> (min-h-11).
const CHIP =
  "flex h-[34px] cursor-pointer items-center gap-1.5 rounded-full bg-ink/[0.07] px-[13px] text-sm font-semibold text-ink transition peer-checked:bg-accent peer-checked:text-accent-contrast peer-focus-visible:ring-4 peer-focus-visible:ring-accent-soft";

function displayUrl(url: string) {
  return url.replace(/^https?:\/\/(www\.)?/, "");
}

// Selo "via instagram.com" sobre a foto (o mockup mostra o @ do post).
function ViaBadge({ url }: { url: string }) {
  return (
    <span className="absolute bottom-2.5 left-2.5 max-w-[80%] truncate rounded-full bg-[rgba(18,24,43,0.75)] px-2.5 py-1 text-xs font-semibold text-cream">
      via {displayUrl(url).split("/")[0]}
    </span>
  );
}

// Tela 4b (modo manual, até a P1): mesmo card no onboarding e no "＋ Colar link".
export function PlaceReviewCard({
  url,
  backHref,
  saveAction,
  heading = "Como chama esse lugar?",
}: PlaceReviewCardProps) {
  const online = useOnline();
  const [state, formAction, isPending] = useActionState(
    saveAction,
    INITIAL_STATE,
  );
  const [title, setTitle] = useState("");
  const [type, setType] = useState<ItemType | null>(null);
  const [status, setStatus] = useState<ItemStatus>("want");
  const [clientError, setClientError] = useState<string | null>(null);
  const error = clientError ?? state.error;

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    if (!type) {
      event.preventDefault();
      setClientError(PICK_TYPE_COPY);
      return;
    }

    setClientError(null);
  }

  return (
    <>
      <BackLink href={backHref} />

      <h1 className="mt-1 text-[26px] font-medium leading-[1.2] text-cream">
        {heading}
      </h1>

      <form action={formAction} onSubmit={handleSubmit} noValidate>
        <input type="hidden" name="url" value={url} />

        <div className={`${CARD} mt-3.5 p-3`}>
          <div aria-hidden="true">
            {type ? (
              <ItemPhoto type={type} variant="hero">
                <ViaBadge url={url} />
              </ItemPhoto>
            ) : (
              <div className="ph1 relative flex h-[150px] items-center justify-center overflow-hidden rounded-[20px] text-[64px]">
                📍
                <ViaBadge url={url} />
              </div>
            )}
          </div>

          <div className="space-y-2.5 px-1.5 pb-1.5 pt-4">
            <div className="space-y-1">
              <label htmlFor="place_title" className={FIELD_LABEL}>
                Nome
              </label>
              <input
                id="place_title"
                name="title"
                type="text"
                autoComplete="off"
                autoFocus
                value={title}
                onChange={(event) => setTitle(event.target.value)}
                placeholder="Ex.: Café da Esquina"
                className="h-[50px] w-full rounded-xl border border-ink/20 bg-[#fbf7f2] px-3.5 font-serif text-xl font-bold text-ink outline-none transition focus:border-accent focus:ring-4 focus:ring-accent-soft"
              />
            </div>

            <fieldset>
              <legend className={FIELD_LABEL}>Tipo</legend>
              <div className="flex flex-wrap gap-x-1.5 pt-1">
                {ITEM_TYPES.map((option) => (
                  <label key={option} className="flex min-h-11 items-center">
                    <input
                      type="radio"
                      name="type"
                      value={option}
                      checked={type === option}
                      onChange={() => {
                        setType(option);
                        setClientError(null);
                      }}
                      className="peer sr-only"
                    />
                    <span className={CHIP}>
                      <span aria-hidden="true">{TYPE_EMOJI[option]}</span>
                      {TYPE_LABELS[option]}
                      {type === option ? " ✓" : null}
                    </span>
                  </label>
                ))}
              </div>
              {type ? (
                <div className="mt-1.5">
                  <TypeHintBox type={type} />
                </div>
              ) : null}
            </fieldset>

            <fieldset>
              <legend className={FIELD_LABEL}>Vai para</legend>
              <div className="flex flex-wrap gap-x-1.5 pt-1">
                {STATUS_OPTIONS.map((option) => (
                  <label key={option.value} className="flex min-h-11 items-center">
                    <input
                      type="radio"
                      name="status"
                      value={option.value}
                      checked={status === option.value}
                      onChange={() => setStatus(option.value)}
                      className="peer sr-only"
                    />
                    <span className={CHIP}>{option.label}</span>
                  </label>
                ))}
              </div>
            </fieldset>

            <div className="space-y-1">
              <label htmlFor="place_notes" className={FIELD_LABEL}>
                Notas{" "}
                <span className="font-normal normal-case tracking-normal">
                  (opcional)
                </span>
              </label>
              <textarea
                id="place_notes"
                name="notes"
                rows={2}
                placeholder={NOTES_PLACEHOLDER}
                className={TEXTAREA}
              />
            </div>

            <div className="space-y-1">
              <p className={FIELD_LABEL}>Link original</p>
              <a
                href={url}
                target="_blank"
                rel="noopener noreferrer"
                className="block truncate text-sm text-ink/70 underline underline-offset-4"
              >
                {displayUrl(url)}
              </a>
            </div>

            {error ? (
              <p role="alert" className={ERROR_TEXT}>
                {error}
              </p>
            ) : null}
          </div>
        </div>

        {!online ? (
          <div className="mt-3.5">
            <OfflineBanner />
          </div>
        ) : null}

        <button
          type="submit"
          disabled={!title.trim() || !online || isPending}
          className={`${BTN_PRIMARY} mt-3.5`}
        >
          {isPending ? "Salvando..." : "Tá certo, salvar"}
        </button>
      </form>

      <Link
        href={backHref}
        className={`${TEXT_LINK_QUIET} mt-3`}
      >
        Descartar
      </Link>
    </>
  );
}
