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

// "abcd-2345" / " ABCD 2345 " → "ABCD2345"
export function normalizeInviteCode(code: string): string {
  return code.replace(/[\s-]/g, "").toUpperCase();
}

// "ABCD2345" → "ABCD-2345"
export function formatInviteCode(code: string): string {
  const normalized = normalizeInviteCode(code);

  if (normalized.length <= 4) {
    return normalized;
  }

  return `${normalized.slice(0, 4)}-${normalized.slice(4)}`;
}

export function inviteLink(origin: string, code: string): string {
  return `${origin}/c/${normalizeInviteCode(code)}`;
}

export function inviteMessage(myName: string, link: string): string {
  return `${myName} te chamou pro Juntos 💛\nBora guardar os lugares que a gente quer viver?\n${link}`;
}

export function whatsappUrl(message: string): string {
  return `https://wa.me/?text=${encodeURIComponent(message)}`;
}

// Nome exibido do espaço: o que o casal definiu ou "{Nome1} & {Nome2}".
export function spaceDisplayName(
  name: string | null | undefined,
  memberNames: string[],
): string {
  const trimmed = name?.trim();

  if (trimmed) {
    return trimmed;
  }

  return memberNames
    .map((memberName) => memberName.trim())
    .filter(Boolean)
    .slice(0, 2)
    .join(" & ");
}

export type InvitePreviewStatus =
  | "valid"
  | "used"
  | "expired"
  | "full"
  | "invalid";

export type InvitePreview = {
  status: InvitePreviewStatus;
  host_first_name: string | null;
  item_count: number;
  thumbnails: string[];
  is_member: boolean;
};

export const HOST_FALLBACK = "quem te chamou";

export const INVITE_UNKNOWN_ERROR =
  "Algo saiu do roteiro. Tenta de novo em instantes.";

const INVITE_STATUS_COPY: Record<
  Exclude<InvitePreviewStatus, "valid">,
  string
> = {
  used: "Esse convite já foi usado. Peça pra {Anfitrião} mandar um novo 💛",
  expired:
    "Esse convite passou da validade (7 dias). Peça pra {Anfitrião} mandar um novo.",
  invalid: "Não achamos esse convite. Confere se o link veio inteiro?",
  full:
    "Esse espaço já está completo, com duas pessoas. Confere com {Anfitrião} se o convite está certo.",
};

export const INVITE_CODE_INVALID =
  "Esse código não confere. Dá uma olhada de novo?";

export const INVITE_CODE_EXPIRED =
  "Esse convite expirou. Pede um novo pro seu par?";

// Tela "Entrar com convite": inválido e expirado ficam na própria tela; os
// outros estados seguem para /c/<código>.
export function inviteCodeStatusError(
  status: InvitePreviewStatus,
): string | null {
  if (status === "invalid") {
    return INVITE_CODE_INVALID;
  }

  if (status === "expired") {
    return INVITE_CODE_EXPIRED;
  }

  return null;
}

const ALREADY_IN_SPACE_COPY =
  "Você já está num espaço com seu par. Pra entrar neste, primeiro saia do atual em Ajustes.";

const INVITE_ERROR_COPY: Record<string, string> = {
  invalid_invite: INVITE_STATUS_COPY.invalid,
  invite_used: INVITE_STATUS_COPY.used,
  invite_expired: INVITE_STATUS_COPY.expired,
  space_full: INVITE_STATUS_COPY.full,
  already_in_space: ALREADY_IN_SPACE_COPY,
  forbidden: INVITE_UNKNOWN_ERROR,
  own_invite: "Esse convite é seu 😉 Mande o link pro seu par.",
  space_has_partner: ALREADY_IN_SPACE_COPY,
};

function withHost(text: string, host: string | null | undefined) {
  return text.replaceAll("{Anfitrião}", host?.trim() || HOST_FALLBACK);
}

export function inviteStatusMessage(
  status: Exclude<InvitePreviewStatus, "valid">,
  host: string | null | undefined,
): string {
  return withHost(INVITE_STATUS_COPY[status], host);
}

type InviteError = { message?: string } | null | undefined;

function inviteErrorKey(error: InviteError) {
  const message = error?.message ?? "";

  return Object.keys(INVITE_ERROR_COPY).find((errorKey) =>
    message.includes(errorKey),
  );
}

export function inviteErrorMessage(
  error: InviteError,
  host?: string | null,
): string {
  const key = inviteErrorKey(error);

  return key ? withHost(INVITE_ERROR_COPY[key], host) : INVITE_UNKNOWN_ERROR;
}

export type InviteErrorAction = { label: string; href: string };

const CREATE_OWN_SPACE: InviteErrorAction = {
  label: "Criar meu próprio espaço",
  href: "/onboarding/nome",
};

const INVITE_ERROR_ACTIONS: Record<string, InviteErrorAction> = {
  space_full: CREATE_OWN_SPACE,
  already_in_space: { label: "Ir pro meu espaço", href: "/" },
  space_has_partner: { label: "Abrir Ajustes", href: "/settings" },
};

export function inviteErrorAction(error: InviteError): InviteErrorAction | null {
  const key = inviteErrorKey(error);

  return (key && INVITE_ERROR_ACTIONS[key]) || null;
}

export function inviteStatusAction(
  status: InvitePreviewStatus,
): InviteErrorAction | null {
  return status === "full" ? CREATE_OWN_SPACE : null;
}
