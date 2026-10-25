"use client";

import Link from "next/link";
import {
  type ClipboardEvent,
  type KeyboardEvent,
  useEffect,
  useRef,
  useState,
} from "react";

import { useCountdown, useOnline } from "@/components/auth-hooks";
import { BackLink, OfflineBanner } from "@/components/auth-ui";
import {
  BTN_PRIMARY,
  BTN_WHITE,
  CARD,
  ERROR_TEXT,
  SCREEN,
  SUBTITLE,
  TEXT_LINK,
  TITLE,
} from "@/components/ui-classes";
import {
  postLoginCallbackPath,
  signInPathWithNext,
} from "@/lib/auth-callback";
import {
  OTP_COPY,
  OTP_LENGTH,
  type OtpErrorKind,
  type OtpErrorLike,
  RESEND_SECONDS,
  formatCountdown,
  otpDigitsFromInput,
  otpSendErrorKind,
  otpVerifyErrorKind,
  retryAfterSeconds,
  waitMessage,
} from "@/lib/otp";
import { createClient } from "@/lib/supabase/client";

type CodigoFormProps = {
  email: string;
  next: string;
  code: string;
};

// Mockup: "Entrar" desabilitado bem apagado (opacidade .45, sem sombra).
function dimDisabled(classes: string) {
  return classes.replace(
    "disabled:opacity-60",
    "disabled:opacity-45 disabled:shadow-none",
  );
}

const EMPTY_DIGITS = Array.from({ length: OTP_LENGTH }, () => "");

// Só chamado em efeitos e handlers (nunca durante o render).
function nowMs() {
  return Date.now();
}

export function CodigoForm({ email, next, code }: CodigoFormProps) {
  const online = useOnline();
  const [digits, setDigits] = useState<string[]>(EMPTY_DIGITS);
  const [errorKind, setErrorKind] = useState<OtpErrorKind | null>(null);
  const [networkFailed, setNetworkFailed] = useState(false);
  const [isVerifying, setIsVerifying] = useState(false);
  const [isResending, setIsResending] = useState(false);
  const [resendRemaining, restartResend] = useCountdown(RESEND_SECONDS);
  const inputsRef = useRef<(HTMLInputElement | null)[]>([]);
  // Quando o último código foi enviado (para a heurística expirado × errado).
  const sentAtRef = useRef<number | null>(null);

  useEffect(() => {
    // A tela abre logo depois do envio feito em /entrar.
    sentAtRef.current = nowMs();

    const handleOnline = () => setNetworkFailed(false);
    window.addEventListener("online", handleOnline);
    return () => window.removeEventListener("online", handleOnline);
  }, []);

  const signInHref = signInPathWithNext(next, code);
  const isOffline = !online;
  const token = digits.join("");
  const isComplete = token.length === OTP_LENGTH;

  function focusBox(index: number) {
    const input = inputsRef.current[Math.max(0, Math.min(OTP_LENGTH - 1, index))];
    input?.focus();
    input?.select();
  }

  function clearDigits() {
    setDigits(EMPTY_DIGITS);
    focusBox(0);
  }

  async function verify(value: string) {
    if (isVerifying || isOffline || value.length !== OTP_LENGTH) {
      return;
    }

    setIsVerifying(true);
    setErrorKind(null);

    const secondsSinceSent =
      sentAtRef.current === null
        ? null
        : (nowMs() - sentAtRef.current) / 1000;
    let kind: OtpErrorKind | null = null;

    try {
      const supabase = createClient();
      const { error } = await supabase.auth.verifyOtp({
        email,
        token: value,
        type: "email",
      });

      if (error) {
        kind = otpVerifyErrorKind(error, { secondsSinceSent });
      }
    } catch (error) {
      kind = otpVerifyErrorKind(error as OtpErrorLike, { secondsSinceSent });
    }

    if (!kind) {
      // Sessão criada no navegador; o /auth/callback decide o destino.
      window.location.replace(postLoginCallbackPath(next, code));
      return;
    }

    setIsVerifying(false);

    if (kind === "offline") {
      setNetworkFailed(true);
      return;
    }

    setErrorKind(kind);

    if (kind !== "desconhecido") {
      clearDigits();
    }
  }

  async function resend() {
    if (isResending || isOffline) {
      return;
    }

    setIsResending(true);
    setErrorKind(null);

    let kind: OtpErrorKind | null = null;
    let waitSeconds: number | null = null;

    try {
      const supabase = createClient();
      const { error } = await supabase.auth.signInWithOtp({
        email,
        options: { shouldCreateUser: true },
      });

      if (error) {
        kind = otpSendErrorKind(error);
        waitSeconds = retryAfterSeconds(error);
      }
    } catch (error) {
      kind = otpSendErrorKind(error as OtpErrorLike);
    }

    setIsResending(false);

    if (!kind) {
      sentAtRef.current = nowMs();
      setNetworkFailed(false);
      restartResend(RESEND_SECONDS);
      clearDigits();
      return;
    }

    if (kind === "offline") {
      setNetworkFailed(true);
      return;
    }

    if (kind === "aguarde") {
      // Mantém a contagem: usa o tempo que o Supabase informar ou o restante local.
      restartResend(
        waitSeconds ?? (resendRemaining > 0 ? resendRemaining : RESEND_SECONDS),
      );
    }

    setErrorKind(kind);
  }

  function updateDigits(nextDigits: string[], focusIndex: number) {
    setDigits(nextDigits);

    if (errorKind && errorKind !== "aguarde") {
      setErrorKind(null);
    }

    const value = nextDigits.join("");

    if (value.length === OTP_LENGTH) {
      inputsRef.current[OTP_LENGTH - 1]?.blur();
      void verify(value);
    } else {
      focusBox(focusIndex);
    }
  }

  function fillFrom(start: number, chars: string[]) {
    const nextDigits = [...digits];

    chars.forEach((char, offset) => {
      if (start + offset < OTP_LENGTH) {
        nextDigits[start + offset] = char;
      }
    });

    updateDigits(nextDigits, start + chars.length);
  }

  function handleChange(index: number, value: string) {
    if (value === "") {
      const nextDigits = [...digits];
      nextDigits[index] = "";
      setDigits(nextDigits);
      return;
    }

    // Digitou por cima de um dígito sem a seleção (comum no celular): fica o novo.
    const current = digits[index];

    if (current && value.length === 2 && value.includes(current)) {
      const typed = value.startsWith(current) ? value[1] : value[0];

      if (/\d/.test(typed)) {
        fillFrom(index, [typed]);
      }

      return;
    }

    const chars = otpDigitsFromInput(value);

    if (!chars) {
      return;
    }

    // Vários dígitos de uma vez = colagem ou preenchimento automático.
    fillFrom(chars.length === OTP_LENGTH ? 0 : index, chars);
  }

  function handlePaste(index: number, event: ClipboardEvent<HTMLInputElement>) {
    event.preventDefault();
    const chars = otpDigitsFromInput(event.clipboardData.getData("text"));

    if (chars) {
      fillFrom(chars.length === OTP_LENGTH ? 0 : index, chars);
    }
  }

  function handleKeyDown(index: number, event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === "Backspace" && !digits[index] && index > 0) {
      event.preventDefault();
      const nextDigits = [...digits];
      nextDigits[index - 1] = "";
      setDigits(nextDigits);
      focusBox(index - 1);
    } else if (event.key === "ArrowLeft" && index > 0) {
      event.preventDefault();
      focusBox(index - 1);
    } else if (event.key === "ArrowRight" && index < OTP_LENGTH - 1) {
      event.preventDefault();
      focusBox(index + 1);
    }
  }

  // No código expirado, o reenvio vira a ação principal e o "Entrar" recua.
  const isExpired = errorKind === "codigo_expirado";
  let message: string | null = null;

  if (errorKind === "aguarde") {
    message = resendRemaining > 0 ? waitMessage(resendRemaining) : null;
  } else if (errorKind) {
    message = OTP_COPY[errorKind];
  }

  return (
    <main className={SCREEN}>
      <BackLink href={signInHref} />

      <section className="mt-2.5">
        <p aria-hidden="true" className="text-[44px] leading-none">
          📬
        </p>
        <h1 className={`${TITLE} mt-2.5`}>Confere seu e-mail</h1>
        <p className={`${SUBTITLE} mt-3`}>
          Mandamos um código de 6 números para{" "}
          <strong className="[overflow-wrap:anywhere] font-semibold text-cream">
            {email}
          </strong>
          .
        </p>
      </section>

      {isOffline || networkFailed ? (
        <div className="mt-5">
          <OfflineBanner />
        </div>
      ) : null}

      <div className={`${CARD} mt-7 space-y-4 px-4 py-[22px]`}>
        <div
          role="group"
          aria-label="Código de 6 números"
          className="flex justify-between gap-1.5"
        >
          {digits.map((digit, index) => (
            <input
              key={index}
              ref={(element) => {
                inputsRef.current[index] = element;
              }}
              type="text"
              inputMode="numeric"
              pattern="[0-9]*"
              autoComplete={index === 0 ? "one-time-code" : "off"}
              autoFocus={index === 0}
              aria-label={`Dígito ${index + 1} de ${OTP_LENGTH}`}
              value={digit}
              readOnly={isVerifying}
              onFocus={(event) => event.target.select()}
              onChange={(event) => handleChange(index, event.target.value)}
              onPaste={(event) => handlePaste(index, event)}
              onKeyDown={(event) => handleKeyDown(index, event)}
              className="h-[58px] w-full min-w-0 max-w-[46px] rounded-[14px] border border-ink/15 bg-[#fbf7f2] text-center text-[28px] font-bold text-ink caret-accent outline-none transition focus:border-2 focus:border-accent read-only:opacity-60"
            />
          ))}
        </div>

        {message ? (
          <p role="alert" className={`${ERROR_TEXT} text-center`}>
            {message}
          </p>
        ) : null}

        {isExpired ? (
          <button
            type="button"
            onClick={resend}
            disabled={isOffline || isResending || resendRemaining > 0}
            className={dimDisabled(BTN_PRIMARY)}
          >
            {isResending
              ? "Mandando..."
              : resendRemaining > 0
                ? `Mandar outro código em ${formatCountdown(resendRemaining)}`
                : "Mandar outro código"}
          </button>
        ) : null}

        <p className="text-center text-sm text-ink/65">
          Não chegou? Olha o spam ou{" "}
          {resendRemaining > 0 ? (
            <strong className="font-bold text-accent">
              reenviar em {formatCountdown(resendRemaining)}
            </strong>
          ) : (
            <button
              type="button"
              onClick={resend}
              disabled={isOffline || isResending}
              className="font-bold text-accent underline underline-offset-2 disabled:opacity-60"
            >
              reenviar
            </button>
          )}
        </p>
      </div>

      <button
        type="button"
        onClick={() => verify(token)}
        disabled={!isComplete || isVerifying || isOffline}
        className={`mt-[22px] ${dimDisabled(isExpired ? BTN_WHITE : BTN_PRIMARY)}`}
      >
        {isVerifying ? "Entrando..." : "Entrar"}
      </button>

      <Link
        href={signInHref}
        className={`${TEXT_LINK} mt-5`}
      >
        Usar outro e-mail
      </Link>

      <p className="mt-[18px] text-center text-[13px] text-cream/55">
        Dica: no celular, o código aparece sozinho acima do teclado.
      </p>
    </main>
  );
}
