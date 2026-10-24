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
        className="flex w-full items-center gap-4 rounded-[28px] bg-surface p-5 text-left text-[#1a2238] opacity-60"
      >
        <span
          aria-hidden="true"
          className="flex h-14 w-14 shrink-0 items-start justify-center gap-1.5 rounded-2xl bg-[#0c66e4] p-3"
        >
          <span className="h-7 w-3 rounded-sm bg-white" />
          <span className="h-4 w-3 rounded-sm bg-white" />
        </span>
        <span className="flex-1">
          <span className="flex flex-wrap items-center gap-2 text-xl font-semibold">
            Trazer do Trello
            <span className="rounded-full bg-[#1a2238]/10 px-2.5 py-0.5 text-sm font-semibold">
              em breve
            </span>
          </span>
          <span className="block text-[#1a2238]/70">
            Já têm uma lista lá? Tragam tudo de uma vez.
          </span>
        </span>
      </button>
      {toast ? <Toast title={toast} /> : null}
    </>
  );
}
