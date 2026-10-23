"use client";

import Link from "next/link";
import { type FormEvent, useActionState, useState } from "react";

import { useOnline } from "@/components/auth-hooks";
import { BackLink, OfflineBanner } from "@/components/auth-ui";
import { PICK_TYPE_COPY, WANT_LABEL } from "@/lib/capture-link";
import { STATUS_LABELS, TYPE_EMOJI, TYPE_LABELS } from "@/lib/labels";
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
};

const ITEM_TYPES = Object.keys(TYPE_LABELS) as ItemType[];
const STATUS_OPTIONS: { value: ItemStatus; label: string }[] = [
  { value: "want", label: `💛 ${WANT_LABEL}` },
  { value: "done", label: STATUS_LABELS.done },
];
const INITIAL_STATE: PlaceReviewState = { error: null };

const FIELD_LABEL =
  "block text-sm font-semibold uppercase tracking-[0.15em] text-[#1a2238]/60";
const CHIP =
  "flex h-11 cursor-pointer items-center gap-2 rounded-full bg-[#1a2238]/8 px-4 text-base font-semibold transition peer-checked:bg-accent peer-checked:text-accent-contrast peer-focus-visible:ring-4 peer-focus-visible:ring-accent-soft";

function displayUrl(url: string) {
  return url.replace(/^https?:\/\/(www\.)?/, "");
}

// Tela 4b (modo manual, até a P1): mesmo card no onboarding e no "＋ Colar link".
export function PlaceReviewCard({
  url,
  backHref,
  saveAction,
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

      <h1 className="mt-4 font-serif text-4xl font-semibold leading-tight tracking-tight">
        Como chama esse lugar?
      </h1>

      <form action={formAction} onSubmit={handleSubmit} noValidate>
        <input type="hidden" name="url" value={url} />

        <div className="mt-6 space-y-6 rounded-[28px] bg-surface p-5 text-[#1a2238]">
          <div
            aria-hidden="true"
            className="h-40 rounded-3xl bg-linear-to-br from-[#f0c4a8] via-[#c97a5a] to-[#8a3f2b]"
          />

          <div className="space-y-2">
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
              className="h-14 w-full rounded-2xl border border-[#1a2238]/15 bg-[#fbf8f4] px-4 font-serif text-2xl font-semibold outline-none transition focus:border-accent focus:ring-4 focus:ring-accent-soft"
            />
          </div>

          <fieldset className="space-y-3">
            <legend className={FIELD_LABEL}>Tipo</legend>
            <div className="flex flex-wrap gap-2 pt-3">
              {ITEM_TYPES.map((option) => (
                <label key={option}>
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
                  </span>
                </label>
              ))}
            </div>
          </fieldset>

          <fieldset className="space-y-3">
            <legend className={FIELD_LABEL}>Vai para</legend>
            <div className="flex flex-wrap gap-2 pt-3">
              {STATUS_OPTIONS.map((option) => (
                <label key={option.value}>
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

          <div className="space-y-2">
            <p className={FIELD_LABEL}>Link original</p>
            <a
              href={url}
              target="_blank"
              rel="noopener noreferrer"
              className="block truncate text-[#1a2238]/75 underline underline-offset-4"
            >
              {displayUrl(url)}
            </a>
          </div>

          {error ? (
            <p role="alert" className="text-sm font-medium text-[#a3402a]">
              {error}
            </p>
          ) : null}
        </div>

        {!online ? (
          <div className="mt-6">
            <OfflineBanner />
          </div>
        ) : null}

        <button
          type="submit"
          disabled={!title.trim() || !online || isPending}
          className="mt-6 flex h-14 w-full items-center justify-center rounded-3xl bg-accent px-4 text-lg font-semibold text-accent-contrast shadow-lg shadow-accent/30 transition hover:brightness-110 disabled:opacity-60"
        >
          {isPending ? "Salvando..." : "Tá certo, salvar"}
        </button>
      </form>

      <Link
        href={backHref}
        className="mx-auto mt-5 text-lg text-foreground/70 underline underline-offset-4 transition hover:text-foreground"
      >
        Descartar
      </Link>
    </>
  );
}
