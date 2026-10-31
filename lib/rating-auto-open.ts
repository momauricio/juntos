import type { ItemStatus } from "@/lib/types";

export function ratingAutoOpenKey(userId: string, itemId: string) {
  return `juntos:nota-auto-aberta:${userId}:${itemId}`;
}

export function shouldAutoOpen({
  status,
  hasMyRating,
  alreadyOpened,
}: {
  status: ItemStatus;
  hasMyRating: boolean;
  alreadyOpened: boolean;
}) {
  return status === "done" && !hasMyRating && !alreadyOpened;
}
