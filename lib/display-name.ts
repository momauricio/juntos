// Regras do nome de exibição (profiles.display_name), usadas na tela "Seu nome".

export const DISPLAY_NAME_MAX = 40;

export const DISPLAY_NAME_ERROR = `Escreve seu nome, com até ${DISPLAY_NAME_MAX} letras.`;

export const DISPLAY_NAME_SAVE_ERROR =
  "Não deu pra salvar seu nome agora. Tenta de novo?";

function codePoints(value: string) {
  return Array.from(value);
}

// "Maria  Clara Souza" → "Maria" (o Google manda o nome completo).
export function firstName(value: string | null | undefined) {
  const first = (value ?? "").trim().split(/\s+/)[0] ?? "";

  return codePoints(first).slice(0, DISPLAY_NAME_MAX).join("");
}

type UserLike = {
  app_metadata?: { provider?: string; providers?: string[] } | null;
  user_metadata?: Record<string, unknown> | null;
};

export function isGoogleUser(user: UserLike) {
  const appMetadata = user.app_metadata ?? {};

  return (
    appMetadata.provider === "google" ||
    (Array.isArray(appMetadata.providers) &&
      appMetadata.providers.includes("google"))
  );
}

// Primeiro nome vindo do Google (full_name, depois name). Vazio se o login não
// foi pelo Google: no login por código o campo começa vazio.
export function googleFirstName(user: UserLike) {
  if (!isGoogleUser(user)) {
    return "";
  }

  const metadata = user.user_metadata ?? {};

  for (const key of ["full_name", "name"]) {
    const value = metadata[key];

    if (typeof value === "string" && value.trim()) {
      return firstName(value);
    }
  }

  return "";
}

// O que o trigger handle_new_user grava quando não há nome do Google:
// a parte do e-mail antes do @, só a primeira palavra, até 40 caracteres.
export function emailFallbackName(email: string | null | undefined) {
  return firstName((email ?? "").split("@")[0]) || "eu";
}

type InitialDisplayNameInput = {
  displayName: string | null | undefined;
  email: string | null | undefined;
  onboardedAt: string | null | undefined;
  googleName: string;
};

// Valor inicial do campo "Seu nome": o nome que a pessoa já escolheu (ou que
// não é só o fallback do e-mail); senão, o nome do Google ou vazio.
export function initialDisplayName({
  displayName,
  email,
  onboardedAt,
  googleName,
}: InitialDisplayNameInput) {
  const current = displayName?.trim() ?? "";

  if (!current) {
    return googleName;
  }

  const isEmailFallback =
    current.toLowerCase() === emailFallbackName(email).toLowerCase();

  return onboardedAt || !isEmailFallback ? current : googleName;
}

export type DisplayNameResult =
  | { ok: true; value: string }
  | { ok: false; error: string };

export function validateDisplayName(value: string): DisplayNameResult {
  const trimmed = value.trim();
  const length = codePoints(trimmed).length;

  if (length < 1 || length > DISPLAY_NAME_MAX) {
    return { ok: false, error: DISPLAY_NAME_ERROR };
  }

  return { ok: true, value: trimmed };
}

// "Como chamamos vocês dois?" (spaces.name). Vazio = nome calculado.
export const SPACE_NAME_MAX = 40;

export function normalizeSpaceName(value: string | null | undefined) {
  const trimmed = (value ?? "").trim();

  return trimmed ? codePoints(trimmed).slice(0, SPACE_NAME_MAX).join("") : null;
}
