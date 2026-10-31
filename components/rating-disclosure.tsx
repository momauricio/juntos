"use client";

import { useEffect, useRef, type ReactNode } from "react";

import { ratingAutoOpenKey, shouldAutoOpen } from "@/lib/rating-auto-open";
import type { ItemStatus } from "@/lib/types";

type RatingDisclosureProps = {
  summary: string;
  status: ItemStatus;
  hasMyRating: boolean;
  userId: string;
  itemId: string;
  children: ReactNode;
};

function readFlag(key: string) {
  try {
    return window.localStorage.getItem(key) != null;
  } catch {
    return false;
  }
}

function writeFlag(key: string) {
  try {
    window.localStorage.setItem(key, "1");
  } catch {}
}

export function RatingDisclosure({
  summary,
  status,
  hasMyRating,
  userId,
  itemId,
  children,
}: RatingDisclosureProps) {
  const detailsRef = useRef<HTMLDetailsElement>(null);

  useEffect(() => {
    const key = ratingAutoOpenKey(userId, itemId);

    if (
      !detailsRef.current ||
      !shouldAutoOpen({ status, hasMyRating, alreadyOpened: readFlag(key) })
    ) {
      return;
    }

    detailsRef.current.open = true;
    writeFlag(key);
  }, [status, hasMyRating, userId, itemId]);

  function close() {
    if (detailsRef.current) {
      detailsRef.current.open = false;
    }
  }

  return (
    <details ref={detailsRef} className="space-y-4">
      <summary className="flex h-12 cursor-pointer list-none items-center justify-center rounded-2xl bg-accent-soft px-5 text-base font-semibold text-accent-strong transition hover:bg-accent hover:text-accent-contrast [&::-webkit-details-marker]:hidden">
        {summary}
      </summary>
      {children}
      <button
        type="button"
        onClick={close}
        className="h-12 w-full rounded-2xl px-5 text-base font-semibold text-foreground/70 ring-1 ring-border transition hover:text-foreground sm:w-auto"
      >
        Depois
      </button>
    </details>
  );
}
