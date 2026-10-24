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
      className="rounded-2xl bg-accent-soft px-4 py-3 text-base font-semibold text-accent-strong"
    >
      {SAVED_DONE_RATING_PROMPT}
    </p>
  );
}
