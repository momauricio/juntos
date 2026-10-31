type AuthRedirectInput = {
  next?: string | null;
  code?: string | null;
  fallback: string;
};

export function safeRedirectPath(
  value: string | null | undefined,
  fallback: string,
) {
  if (!value || !value.startsWith("/") || value.startsWith("//")) {
    return fallback;
  }

  try {
    const parsed = new URL(value, "https://juntos.local");

    if (parsed.origin !== "https://juntos.local") {
      return fallback;
    }

    return `${parsed.pathname}${parsed.search}${parsed.hash}`;
  } catch {
    return fallback;
  }
}

export function authRedirectPath({ next, code, fallback }: AuthRedirectInput) {
  const safeNext = safeRedirectPath(next, "");

  if (safeNext) {
    return safeNext;
  }

  const inviteCode = code?.trim();

  if (inviteCode) {
    return `/onboarding?code=${encodeURIComponent(inviteCode)}`;
  }

  return fallback;
}

type PostLoginInput = {
  next?: string | null;
  inviteCode?: string | null;
  hasSpace: boolean;
  onboarded: boolean;
};

function inviteCodeFromNext(safeNext: string) {
  if (!safeNext) {
    return "";
  }

  const parsed = new URL(safeNext, "https://juntos.local");

  if (parsed.pathname !== "/onboarding") {
    return "";
  }

  return parsed.searchParams.get("code")?.trim() ?? "";
}

// Destino depois do login (callback do Google ou código no e-mail):
// convite > tela "Seu nome" (1ª vez, sem espaço) > criar/entrar no espaço > next.
export function postLoginPath({
  next,
  inviteCode,
  hasSpace,
  onboarded,
}: PostLoginInput) {
  const safeNext = safeRedirectPath(next, "");
  const code = inviteCode?.trim() || inviteCodeFromNext(safeNext);

  if (code) {
    return `/onboarding?code=${encodeURIComponent(code)}`;
  }

  if (!hasSpace) {
    return onboarded ? "/onboarding" : "/onboarding/nome";
  }

  return safeNext || "/";
}
