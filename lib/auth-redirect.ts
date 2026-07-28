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
