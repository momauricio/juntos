// Regras do login por código no e-mail (OTP de 6 dígitos). Tudo aqui é puro
// para poder ser testado sem Supabase nem navegador.

export const OTP_LENGTH = 6;
// Espelha o "intervalo mínimo entre envios" (60 s) configurado no Supabase.
export const RESEND_SECONDS = 60;
// Espelha a expiração do código (600 s = 10 min) configurada no Supabase.
export const OTP_EXPIRY_SECONDS = 600;

export type OtpErrorKind =
  | "email_invalido"
  | "aguarde"
  | "codigo_errado"
  | "codigo_expirado"
  | "muitas_tentativas"
  | "offline"
  | "desconhecido";

// Microcopy exata da spec (tabela "Estados e erros").
export const OTP_COPY = {
  email_invalido: "Esse e-mail parece incompleto. Confere?",
  codigo_errado: "Código não confere. Dá uma olhada de novo no e-mail.",
  codigo_expirado: "Esse código expirou. Quer que a gente mande outro?",
  muitas_tentativas:
    "Muitas tentativas por agora. Espera um pouquinho e pede um código novo.",
  offline: "Sem internet agora. Assim que voltar, é só tentar de novo.",
  desconhecido:
    "Algo saiu do roteiro do nosso lado. Tenta de novo em instantes.",
} as const;

export function waitMessage(seconds: number) {
  return `Calma que já mandamos! Dá pra pedir outro em ${formatCountdown(seconds)}.`;
}

// Campos que usamos de um AuthError do supabase-js (ou de um erro qualquer).
export type OtpErrorLike = {
  name?: string;
  status?: number;
  code?: string;
  message?: string;
};

const EMAIL_PATTERN = /^[^\s@]+@[^\s@.]+(\.[^\s@.]+)*\.[^\s@.]{2,}$/;

export function normalizeEmail(value: string) {
  return value.trim().toLowerCase();
}

export function isValidEmail(value: string) {
  return EMAIL_PATTERN.test(normalizeEmail(value));
}

// Aceita colagens como "123 456", "123-456" ou "123.456".
export function normalizeOtpCode(value: string) {
  return value.replace(/[\s.\-–]/g, "");
}

export function isValidOtpCode(value: string) {
  return new RegExp(`^\\d{${OTP_LENGTH}}$`).test(normalizeOtpCode(value));
}

// Dígitos aproveitáveis de uma colagem/autofill; null se não parece um código.
export function otpDigitsFromInput(value: string) {
  const normalized = normalizeOtpCode(value);

  if (!/^\d+$/.test(normalized)) {
    return null;
  }

  return normalized.slice(0, OTP_LENGTH).split("");
}

export function formatCountdown(totalSeconds: number) {
  const safe = Math.max(0, Math.ceil(totalSeconds));
  const minutes = Math.floor(safe / 60);
  const seconds = safe % 60;

  return `${minutes}:${String(seconds).padStart(2, "0")}`;
}

// O Supabase responde "For security purposes, you can only request this after
// 42 seconds." quando o reenvio é cedo demais.
export function retryAfterSeconds(error: OtpErrorLike) {
  const match = error.message?.match(/after (\d+) seconds?/i);

  return match ? Number(match[1]) : null;
}

function isNetworkError(error: OtpErrorLike) {
  if (error.name === "AuthRetryableFetchError") {
    return true;
  }

  if (error.status === 0) {
    return true;
  }

  return (
    error.status === undefined &&
    /failed to fetch|network|load failed|fetch failed/i.test(error.message ?? "")
  );
}

function isSendTooSoon(error: OtpErrorLike) {
  return (
    error.code === "over_email_send_rate_limit" ||
    retryAfterSeconds(error) !== null
  );
}

// Erro do signInWithOtp (envio/reenvio do código).
export function otpSendErrorKind(error: OtpErrorLike): OtpErrorKind {
  if (isNetworkError(error)) {
    return "offline";
  }

  if (isSendTooSoon(error)) {
    return "aguarde";
  }

  if (error.status === 429 || error.code === "over_request_rate_limit") {
    return "muitas_tentativas";
  }

  if (
    error.code === "email_address_invalid" ||
    (error.code === "validation_failed" && /email/i.test(error.message ?? ""))
  ) {
    return "email_invalido";
  }

  return "desconhecido";
}

type VerifyContext = {
  // Segundos desde o último envio do código nesta tela (null se desconhecido).
  secondsSinceSent: number | null;
};

// Erro do verifyOtp.
//
// Heurística expirado × errado: o Supabase devolve o mesmo erro para os dois
// casos (status 403, code "otp_expired", mensagem "Token has expired or is
// invalid"). Então:
// - se a mensagem fala só em "expired" (sem "invalid"), é expirado;
// - se o code/mensagem é o genérico, usamos o relógio local: se já passou o
//   tempo de expiração (OTP_EXPIRY_SECONDS) desde o último envio, é expirado;
//   senão, tratamos como código errado (o caso mais comum: digitou errado).
// Sem saber quando o código foi enviado (ex.: recarregou a página), preferimos
// "código errado", que limpa as caixas e deixa o "reenviar" à mão.
export function otpVerifyErrorKind(
  error: OtpErrorLike,
  { secondsSinceSent }: VerifyContext,
): OtpErrorKind {
  if (isNetworkError(error)) {
    return "offline";
  }

  if (error.status === 429 || error.code === "over_request_rate_limit") {
    return "muitas_tentativas";
  }

  const message = error.message ?? "";
  const looksExpired = /expired/i.test(message);
  const looksInvalid = /invalid/i.test(message);

  if (looksExpired && !looksInvalid) {
    return "codigo_expirado";
  }

  const isTokenError =
    error.code === "otp_expired" ||
    error.status === 403 ||
    looksExpired ||
    looksInvalid;

  if (!isTokenError) {
    return "desconhecido";
  }

  if (secondsSinceSent !== null && secondsSinceSent >= OTP_EXPIRY_SECONDS) {
    return "codigo_expirado";
  }

  return "codigo_errado";
}
