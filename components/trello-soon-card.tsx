"use client";

import { Toast, useToast } from "@/components/toast";
import { TRELLO_SOON_COPY } from "@/lib/capture-link";

// Até a P2: aparece desabilitado e só avisa que está chegando.
export function TrelloSoonCard() {
  const [toast, showToast] = useToast();

  return (
    <>
      <button
        type="button"
        aria-disabled="true"
        onClick={() => showToast(TRELLO_SOON_COPY)}
        className="flex w-full items-center gap-3.5 rounded-[28px] bg-surface-muted p-4 text-left text-ink shadow-[0_18px_40px_rgba(0,0,0,0.22)]"
      >
        <span
          aria-hidden="true"
          className="flex h-12 w-12 shrink-0 items-start justify-center gap-1 rounded-[14px] bg-[#0c66e4] pt-3 opacity-70"
        >
          <span className="h-6 w-3 rounded-[3px] bg-white" />
          <span className="h-4 w-3 rounded-[3px] bg-white" />
        </span>
        <span className="min-w-0 flex-1">
          <span className="flex flex-wrap items-center gap-2 text-base font-bold">
            Trazer do Trello
            <span className="rounded-full bg-ink/10 px-2 py-px text-xs font-semibold">
              em breve
            </span>
          </span>
          <span className="block text-sm text-ink/65">
            Já têm uma lista lá? Tragam tudo de uma vez.
          </span>
        </span>
        <span aria-hidden="true" className="text-xl text-ink/40">
          ›
        </span>
      </button>
      {toast ? <Toast title={toast} /> : null}
    </>
  );
}
