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
