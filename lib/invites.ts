const ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

export function generateInviteCode(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(8));
  return Array.from(bytes, (b) => ALPHABET[b % ALPHABET.length]).join("");
}

export function inviteExpiresAt(from: Date = new Date()): Date {
  return new Date(from.getTime() + 7 * 24 * 60 * 60 * 1000);
}

export function isInviteExpired(
  expiresAt: Date | string,
  now: Date = new Date(),
): boolean {
  return new Date(expiresAt).getTime() <= now.getTime();
}
