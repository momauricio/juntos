"use client";

import { useRouter } from "next/navigation";
import { type FormEvent, useRef, useState, useTransition } from "react";

import { useOnline } from "@/components/auth-hooks";
import { OfflineBanner } from "@/components/auth-ui";
import {
  captureLink,
  EMPTY_CLIPBOARD_COPY,
  NOT_A_LINK_COPY,
} from "@/lib/capture-link";

type Notice = { text: string; isError: boolean } | null;

// Tela 4 e "＋ Colar link": valida o link e abre a revisão em `reviewPath?url=`.
export function LinkPasteCard({ reviewPath }: { reviewPath: string }) {
  const router = useRouter();
  const online = useOnline();
  const inputRef = useRef<HTMLInputElement>(null);
  const [value, setValue] = useState("");
  const [notice, setNotice] = useState<Notice>(null);
  const [isPending, startTransition] = useTransition();
  const disabled = !online || isPending;

  function focusInput() {
    inputRef.current?.focus();
  }

  function openReview(text: string) {
    if (disabled) {
      return;
    }

    const url = captureLink(text);

    if (!url) {
      setNotice({ text: NOT_A_LINK_COPY, isError: true });
      focusInput();
      return;
    }

    setNotice(null);
    startTransition(() => {
      router.push(`${reviewPath}?url=${encodeURIComponent(url)}`);
    });
  }

  async function handlePaste() {
    let text: string;

    try {
      text = (await navigator.clipboard.readText()).trim();
    } catch {
      focusInput();
      return;
    }

    if (!text) {
      setNotice({ text: EMPTY_CLIPBOARD_COPY, isError: false });
      focusInput();
      return;
    }

    setValue(text);
    openReview(text);
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    openReview(value);
  }

  return (
    <>
      {!online ? (
        <div className="mt-8">
          <OfflineBanner />
        </div>
      ) : null}

      <form
        onSubmit={handleSubmit}
        noValidate
        className="mt-8 space-y-4 rounded-[28px] bg-surface p-6 text-[#1a2238]"
      >
        <label
          htmlFor="capture_link"
          className="flex items-center gap-3 text-xl font-semibold"
        >
          <span aria-hidden="true" className="text-3xl">
            📸
          </span>
          Link do Instagram
        </label>

        <div className="flex gap-3">
          <input
            ref={inputRef}
            id="capture_link"
            name="url"
            type="text"
            inputMode="url"
            enterKeyHint="go"
            autoCapitalize="none"
            autoCorrect="off"
            autoComplete="off"
            spellCheck={false}
            value={value}
            onChange={(event) => {
              setValue(event.target.value);
              setNotice(null);
            }}
            placeholder="instagram.com/p/…"
            aria-invalid={Boolean(notice?.isError)}
            aria-describedby="capture_link-help"
            className="h-14 min-w-0 flex-1 rounded-2xl border border-[#1a2238]/15 bg-[#fbf8f4] px-4 text-lg outline-none transition placeholder:text-[#1a2238]/40 focus:border-accent focus:ring-4 focus:ring-accent-soft"
          />
          <button
            type="button"
            onClick={handlePaste}
            disabled={disabled}
            className="h-14 shrink-0 rounded-2xl bg-accent px-6 text-lg font-semibold text-accent-contrast transition hover:brightness-110 disabled:opacity-60"
          >
            Colar
          </button>
        </div>

        {notice ? (
          <p
            role={notice.isError ? "alert" : "status"}
            className={
              notice.isError
                ? "text-sm font-medium text-[#a3402a]"
                : "font-semibold"
            }
          >
            {notice.text}
          </p>
        ) : null}

        <p id="capture_link-help" className="text-[#1a2238]/70">
          No Instagram: toque em ⋯ no post →{" "}
          <strong className="font-semibold">Copiar link</strong>
        </p>
      </form>
    </>
  );
}
