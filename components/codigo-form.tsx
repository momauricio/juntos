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

  let message: string | null = null;

  if (errorKind === "aguarde") {
    message = resendRemaining > 0 ? waitMessage(resendRemaining) : null;
  } else if (errorKind) {
    message = OTP_COPY[errorKind];
  }

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-md flex-col px-6 pb-10 pt-8 text-foreground">
      <BackLink href={signInHref} />

      <section className="mt-8 space-y-4">
        <p aria-hidden="true" className="text-6xl">
          📬
        </p>
        <h1 className="font-serif text-4xl font-semibold leading-tight tracking-tight sm:text-5xl">
          Confere seu e-mail
        </h1>
        <p className="text-lg leading-8 text-foreground/70">
          Mandamos um código de 6 números para{" "}
          <strong className="[overflow-wrap:anywhere] font-semibold text-foreground">
            {email}
          </strong>
          .
        </p>
      </section>

      {isOffline || networkFailed ? (
        <div className="mt-6">
          <OfflineBanner />
        </div>
      ) : null}

      <div className="mt-8 space-y-5 rounded-[28px] bg-surface p-5 sm:p-6">
        <div
          role="group"
          aria-label="Código de 6 números"
          className="flex justify-between gap-2"
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
              className="h-16 w-full min-w-0 rounded-2xl border border-[#1a2238]/15 bg-[#fbf8f4] text-center text-3xl font-bold outline-none transition focus:border-2 focus:border-accent read-only:opacity-60"
            />
          ))}
        </div>

        {message ? (
          <p role="alert" className="text-center text-sm font-medium text-[#a3402a]">
            {message}
          </p>
        ) : null}

        {errorKind === "codigo_expirado" ? (
          <button
            type="button"
            onClick={resend}
            disabled={isOffline || isResending}
            className="flex h-12 w-full items-center justify-center rounded-2xl bg-accent-soft px-4 text-base font-semibold transition hover:brightness-95 disabled:opacity-60"
          >
            Mandar outro código
          </button>
        ) : null}

        <p className="text-center text-base text-[#1a2238]/70">
          Não chegou? Olha o spam ou{" "}
          {resendRemaining > 0 ? (
            <strong className="font-semibold text-accent">
              reenviar em {formatCountdown(resendRemaining)}
            </strong>
          ) : (
            <button
              type="button"
              onClick={resend}
              disabled={isOffline || isResending}
              className="font-semibold text-accent underline underline-offset-2 disabled:opacity-60"
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
        className="mt-6 flex h-14 w-full items-center justify-center rounded-3xl bg-accent px-4 text-lg font-semibold text-accent-contrast shadow-lg shadow-accent/30 transition hover:brightness-110 disabled:opacity-45 disabled:shadow-none"
      >
        {isVerifying ? "Entrando..." : "Entrar"}
      </button>

      <Link
        href={signInHref}
        className="mx-auto mt-6 block w-fit border-b border-foreground/60 pb-0.5 text-base font-semibold text-foreground"
      >
        Usar outro e-mail
      </Link>

      <p className="mt-6 text-center text-sm text-foreground/60">
        Dica: no celular, o código aparece sozinho acima do teclado.
      </p>
    </main>
  );
}
