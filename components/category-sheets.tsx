"use client";

import { useRef, useState, type FormEvent } from "react";

import { CategoryPreviewTile } from "@/components/category-tile";
import { Sheet } from "@/components/overlay";
import { BTN_PRIMARY, ERROR_TEXT } from "@/components/ui-classes";
import { useLivePause } from "@/components/use-live-pause";
import {
  CATEGORY_COLORS,
  CATEGORY_DELETE_COPY,
  CATEGORY_SHEET_COPY,
  EMOJI_SUGGESTIONS,
  deleteCountChips,
  isSingleEmoji,
  type CategoryCounts,
  type CategoryInput,
} from "@/lib/categories";
import type { Category, CategoryColor } from "@/lib/types";

// Mockup .cap: rótulo pequeno em caixa alta.
const CAP = "mb-1.5 mt-3.5 block text-xs font-bold uppercase tracking-[0.08em] text-ink/60";
// Mockup .emo / .emo.on.
const EMO =
  "flex aspect-square min-w-0 max-w-[44px] flex-1 items-center justify-center rounded-[14px] text-2xl transition";
const EMO_ON = "bg-white shadow-[0_0_0_2.5px_#c45c3e]";
const EMO_OFF = "bg-ink/[0.07] hover:bg-ink/[0.11]";
// Botão secundário das folhas ("Entendi", "Cancelar").
const BTN_SHEET_OUTLINE =
  "mt-2 flex h-12 w-full items-center justify-center rounded-2xl border border-ink/20 text-[15.5px] font-semibold text-ink transition hover:bg-ink/[0.05]";
const BTN_DANGER =
  "flex h-[52px] w-full items-center justify-center rounded-2xl bg-[#b83b4b] px-5 text-base font-semibold text-white shadow-[0_10px_24px_rgba(184,59,75,0.3)] transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-60";

export type SheetCategory = Pick<Category, "id" | "name" | "emoji" | "color">;

type Field = "name" | "emoji";

// Folha 54 "Nova categoria" e, ao editar, "Editar categoria" / "Salvar".
// `onSubmit` devolve o texto de erro (validação ou banco) ou null se salvou.
export function CategorySheet({
  category,
  focus = "name",
  preview,
  validate,
  onSubmit,
  onClose,
}: {
  // null = nova.
  category: SheetCategory | null;
  // Renomear → o nome; Trocar emoji e cor → os emojis.
  focus?: Field;
  // Ao editar: o número e a amostra do quadrado (na nova, "0" e "ainda vazia").
  preview?: { count: number; sample: string };
  validate: (input: CategoryInput) => string | null;
  onSubmit: (input: CategoryInput) => Promise<string | null>;
  onClose: () => void;
}) {
  const editing = category !== null;
  const initialEmoji = category?.emoji ?? EMOJI_SUGGESTIONS[0];
  const [name, setName] = useState(category?.name ?? "");
  const [emoji, setEmoji] = useState<string>(initialEmoji);
  const [color, setColor] = useState<CategoryColor>(category?.color ?? "ph5");
  // "outro…": aberto quando o emoji não é uma das 6 sugestões.
  const [otherOpen, setOtherOpen] = useState(
    !(EMOJI_SUGGESTIONS as readonly string[]).includes(initialEmoji),
  );
  const [other, setOther] = useState(otherOpen ? initialEmoji : "");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const nameRef = useRef<HTMLInputElement>(null);
  const emojiRef = useRef<HTMLButtonElement>(null);
  // Folha aberta = Realtime pausado (não muda a lista enquanto digita).
  const pauseRef = useLivePause<HTMLFormElement>();

  const chosenEmoji = otherOpen ? other.trim() : emoji;
  const otherValid = isSingleEmoji(other);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending) return;
    const input: CategoryInput = { name, emoji: chosenEmoji, color };
    const problem = validate(input);
    if (problem) {
      setError(problem);
      return;
    }
    setPending(true);
    const result = await onSubmit(input);
    setPending(false);
    if (result) setError(result);
  }

  const previewEmoji = otherOpen ? (otherValid ? other.trim() : "❔") : emoji;

  return (
    <Sheet
      onClose={onClose}
      initialFocus={focus === "emoji" ? emojiRef : nameRef}
      title={(id) => (
        <div className="flex items-start justify-between gap-3">
          <h2 id={id} className="text-[25px] leading-[1.2]">
            {editing ? CATEGORY_SHEET_COPY.editTitle : CATEGORY_SHEET_COPY.createTitle}
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="-mr-2 -mt-1.5 flex min-h-11 items-center px-2 text-[15px] font-semibold text-ink/65 transition hover:text-ink"
          >
            {CATEGORY_SHEET_COPY.cancel}
          </button>
        </div>
      )}
    >
      <p className="-mt-1 text-[14.5px] text-ink/65">{CATEGORY_SHEET_COPY.subtitle}</p>

      <form ref={pauseRef} onSubmit={submit} noValidate>
        <label htmlFor="category_name" className={CAP}>
          {CATEGORY_SHEET_COPY.nameLabel}
        </label>
        <input
          id="category_name"
          ref={nameRef}
          type="text"
          value={name}
          autoComplete="off"
          enterKeyHint="done"
          onChange={(event) => {
            setName(event.target.value);
            setError(null);
          }}
          placeholder={CATEGORY_SHEET_COPY.namePlaceholder}
          className="h-[50px] w-full rounded-xl border border-ink/[0.18] bg-[#fbf7f2] px-3.5 text-base font-semibold text-ink caret-accent outline-none transition placeholder:font-normal placeholder:text-ink/45 focus:border-accent focus:ring-4 focus:ring-accent-soft"
        />

        <p id="category_emoji_label" className={CAP}>
          {CATEGORY_SHEET_COPY.emojiLabel}
        </p>
        <div
          role="radiogroup"
          aria-labelledby="category_emoji_label"
          className="flex gap-1.5"
        >
          {EMOJI_SUGGESTIONS.map((option, index) => {
            const on = !otherOpen && emoji === option;
            return (
              <button
                key={option}
                ref={on ? emojiRef : undefined}
                type="button"
                role="radio"
                aria-checked={on}
                aria-label={option}
                onClick={() => {
                  setEmoji(option);
                  setOtherOpen(false);
                  setError(null);
                }}
                className={`${EMO} ${on ? EMO_ON : EMO_OFF}`}
              >
                <span aria-hidden="true">{option}</span>
              </button>
            );
          })}
          <button
            ref={otherOpen ? emojiRef : undefined}
            type="button"
            role="radio"
            aria-checked={otherOpen}
            onClick={() => {
              setOtherOpen(true);
              setError(null);
            }}
            className={`flex h-11 shrink-0 items-center justify-center rounded-[14px] px-2.5 text-[14.5px] font-bold text-ink transition ${
              otherOpen ? EMO_ON : EMO_OFF
            }`}
          >
            {otherOpen && otherValid ? (
              <span className="text-2xl">{other.trim()}</span>
            ) : (
              CATEGORY_SHEET_COPY.otherEmoji
            )}
          </button>
        </div>
        {otherOpen ? (
          <input
            type="text"
            value={other}
            // Abre já com o teclado: a pessoa tocou em "outro…".
            autoFocus
            autoComplete="off"
            aria-label={CATEGORY_SHEET_COPY.otherEmojiLabel}
            placeholder={CATEGORY_SHEET_COPY.otherEmojiPlaceholder}
            onChange={(event) => {
              setOther(event.target.value);
              setError(null);
            }}
            className="mt-2 h-11 w-full rounded-xl border border-ink/[0.18] bg-[#fbf7f2] px-3.5 text-xl text-ink outline-none transition placeholder:text-[15px] placeholder:text-ink/45 focus:border-accent focus:ring-4 focus:ring-accent-soft"
          />
        ) : null}

        <p id="category_color_label" className={CAP}>
          {CATEGORY_SHEET_COPY.colorLabel}
        </p>
        <div
          role="radiogroup"
          aria-labelledby="category_color_label"
          className="flex flex-wrap gap-2.5 pl-[3px]"
        >
          {CATEGORY_COLORS.map((option) => {
            const on = color === option.token;
            return (
              <button
                key={option.token}
                type="button"
                role="radio"
                aria-checked={on}
                aria-label={option.name}
                onClick={() => setColor(option.token)}
                className={`h-8 w-8 shrink-0 rounded-full transition ${option.token} ${
                  on ? "shadow-[0_0_0_3px_#f3ebe3,0_0_0_5.5px_#1a2238]" : ""
                }`}
              />
            );
          })}
        </div>

        <p className={CAP}>{CATEGORY_SHEET_COPY.previewLabel}</p>
        <div className="flex items-center gap-3.5">
          <CategoryPreviewTile
            emoji={previewEmoji}
            name={name.trim()}
            color={color}
            count={preview?.count ?? 0}
            sample={preview?.sample ?? CATEGORY_SHEET_COPY.previewEmpty}
          />
          {editing ? null : (
            <p className="text-sm leading-[1.45] text-ink/65">
              {CATEGORY_SHEET_COPY.previewHint}
            </p>
          )}
        </div>

        {error ? (
          <p role="alert" className={`${ERROR_TEXT} mt-3`}>
            {error}
          </p>
        ) : null}

        <button
          type="submit"
          disabled={!name.trim() || pending}
          className={`${BTN_PRIMARY} mt-4`}
        >
          {editing ? CATEGORY_SHEET_COPY.save : CATEGORY_SHEET_COPY.create}
        </button>
      </form>
    </Sheet>
  );
}

// 55b: categoria com itens. Só o aviso, sem botão de apagar (C1).
export function CategoryBlockedSheet({
  category,
  counts,
  onSeeItems,
  onClose,
}: {
  category: SheetCategory;
  counts: CategoryCounts;
  onSeeItems: () => void;
  onClose: () => void;
}) {
  const total = counts.want + counts.done;

  return (
    <Sheet
      onClose={onClose}
      title={(id) => (
        <>
          <div aria-hidden="true" className="text-[34px] leading-tight">
            {category.emoji}
          </div>
          <h2 id={id} className="mt-1 text-[25px] leading-[1.2]">
            {CATEGORY_DELETE_COPY.blockedTitle(category.name, total)}
          </h2>
        </>
      )}
    >
      <p className="mt-1.5 text-[15.5px] leading-[1.4] text-ink/65">
        {CATEGORY_DELETE_COPY.blockedText}
      </p>
      <div className="mt-3 flex flex-wrap gap-2">
        {deleteCountChips(counts).map((chip) => (
          <span
            key={chip}
            className="inline-flex h-[34px] items-center rounded-full bg-ink/[0.07] px-[13px] text-sm font-semibold text-ink"
          >
            {chip}
          </span>
        ))}
      </div>
      <button type="button" onClick={onSeeItems} className={`${BTN_PRIMARY} mt-[18px]`}>
        {CATEGORY_DELETE_COPY.seeItems}
      </button>
      <button type="button" onClick={onClose} className={BTN_SHEET_OUTLINE}>
        {CATEGORY_DELETE_COPY.understood}
      </button>
    </Sheet>
  );
}

// 55c: categoria vazia. Confirmação simples.
export function CategoryDeleteSheet({
  category,
  onConfirm,
  onClose,
}: {
  category: SheetCategory;
  onConfirm: () => Promise<string | null>;
  onClose: () => void;
}) {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const cancelRef = useRef<HTMLButtonElement>(null);

  return (
    <Sheet
      onClose={onClose}
      // Ação perigosa: o foco começa no "Cancelar".
      initialFocus={cancelRef}
      title={(id) => (
        <h2 id={id} className="mt-1 text-[25px] leading-[1.2]">
          {CATEGORY_DELETE_COPY.confirmTitle(category.name)}
        </h2>
      )}
    >
      <p className="mt-1.5 text-[15.5px] text-ink/65">{CATEGORY_DELETE_COPY.confirmText}</p>
      <CategoryPreviewTile
        emoji={category.emoji}
        name={category.name}
        color={category.color}
        count={0}
        sample={CATEGORY_SHEET_COPY.previewEmpty}
        className="mx-auto mt-3.5"
      />
      {error ? (
        <p role="alert" className={`${ERROR_TEXT} mt-3`}>
          {error}
        </p>
      ) : null}
      <button
        type="button"
        disabled={pending}
        onClick={async () => {
          setPending(true);
          const result = await onConfirm();
          setPending(false);
          setError(result);
        }}
        className={`${BTN_DANGER} mt-[18px]`}
      >
        {CATEGORY_DELETE_COPY.confirm}
      </button>
      <button ref={cancelRef} type="button" onClick={onClose} className={BTN_SHEET_OUTLINE}>
        {CATEGORY_DELETE_COPY.cancel}
      </button>
    </Sheet>
  );
}
