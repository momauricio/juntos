import { safeRedirectPath } from "@/lib/auth-redirect";

export type AuthErrorReason = "oauth_cancelado" | "link_invalido" | "desconhecido";

export const AUTH_ERROR_REASONS: readonly AuthErrorReason[] = [
  "oauth_cancelado",
  "link_invalido",
  "desconhecido",
];

type ExchangeError = {
  status?: number;
  code?: string;
  name?: string;
};

export const AUTH_ERROR_TITLE = "Ops, não deu pra entrar";

export const AUTH_ERROR_COPY: Record<AuthErrorReason, string> = {
  oauth_cancelado:
    "Parece que o login com o Google foi cancelado. Quer tentar de novo?",
  link_invalido: "Esse link expirou ou já foi usado. Vamos entrar de novo?",
  desconhecido:
    "Algo saiu do roteiro do nosso lado. Tenta de novo em instantes.",
};

export function parseAuthErrorReason(
  value: string | null | undefined,
): AuthErrorReason {
  return AUTH_ERROR_REASONS.find((reason) => reason === value) ?? "desconhecido";
}

export function reasonFromCallbackParams(
  params: URLSearchParams,
): AuthErrorReason | null {
  const error = params.get("error");
  const errorCode = params.get("error_code");
  const errorDescription = params.get("error_description");

  if (!error && !errorCode && !errorDescription) {
    return null;
  }

  if (errorCode && (errorCode === "otp_expired" || /expired|invalid/.test(errorCode))) {
    return "link_invalido";
  }

  if (error === "access_denied") {
    return "oauth_cancelado";
  }

  return "desconhecido";
}

export function reasonFromExchangeError(error: ExchangeError): AuthErrorReason {
  const { status, code } = error;

  if (typeof status === "number" && status >= 400 && status <= 499) {
    return "link_invalido";
  }

  if (code && /flow_state|code_verifier|otp|expired|invalid|bad_code/.test(code)) {
    return "link_invalido";
  }

  return "desconhecido";
}

export function authErrorPath(reason: AuthErrorReason, next: string) {
  const params = new URLSearchParams({ motivo: reason });
  const safeNext = safeRedirectPath(next, "");

  if (safeNext) {
    params.set("next", safeNext);
  }

  return `/auth/erro?${params.toString()}`;
}

// Vira "/entrar" no PR2, quando a nova tela de entrada existir.
export function signInPathWithNext(next: string | null | undefined) {
  const safeNext = safeRedirectPath(next, "");

  if (!safeNext) {
    return "/login";
  }

  return `/login?${new URLSearchParams({ next: safeNext }).toString()}`;
}
