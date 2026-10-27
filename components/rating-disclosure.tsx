"use client";

import { useEffect, useRef, type ReactNode } from "react";

import { BTN_OUTLINE, BTN_PRIMARY, BTN_SOFT } from "@/components/ui-classes";
import { ratingAutoOpenKey, shouldAutoOpen } from "@/lib/rating-auto-open";
import type { ItemStatus } from "@/lib/types";

type RatingDisclosureProps = {
  summary: string;
  status: ItemStatus;
  hasMyRating: boolean;
  userId: string;
  itemId: string;
  // Botão terracota largo ("✓ Já fizemos" em Queremos).
  primary?: boolean;
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
  primary = false,
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
    <details ref={detailsRef} className="group space-y-3">
      <summary
        className={`${primary ? BTN_PRIMARY : BTN_SOFT} cursor-pointer list-none [&::-webkit-details-marker]:hidden`}
      >
        {summary}
      </summary>
      {children}
      <button
        type="button"
        onClick={close}
        className={BTN_OUTLINE}
      >
        Depois
      </button>
    </details>
  );
}
