"use client";

import { useSearchParams } from "next/navigation";

import { SAVED_DONE_RATING_PROMPT } from "@/lib/capture-link";

// Vindo do "＋ Colar link" com "Já fizemos" (?salvo=done): pede a nota.
export function SavedRatingPrompt() {
  const searchParams = useSearchParams();

  if (searchParams.get("salvo") !== "done") {
    return null;
  }

  return (
    <p
      role="status"
      className="flex items-center gap-2.5 rounded-[18px] bg-cream px-3.5 py-3 text-[15px] font-semibold text-ink shadow-[0_14px_30px_rgba(0,0,0,0.35)]"
    >
      {SAVED_DONE_RATING_PROMPT}
    </p>
  );
}
