"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { type FormEvent, useEffect, useState } from "react";

import { useCountdown, useOnline } from "@/components/auth-hooks";
import {
  BackLink,
  GoogleIcon,
  OfflineBanner,
  OrDivider,
} from "@/components/auth-ui";
import {
  BTN_SOFT_LG,
  BTN_WHITE,
  CARD,
  ERROR_TEXT,
  EYEBROW,
  INPUT,
  LABEL,
  SCREEN,
  SUBTITLE,
  TITLE,
} from "@/components/ui-classes";
import { AUTH_ERROR_COPY, postLoginCallbackPath } from "@/lib/auth-callback";
import {
  OTP_COPY,
  type OtpErrorKind,
  type OtpErrorLike,
  RESEND_SECONDS,
  isValidEmail,
  normalizeEmail,
  otpSendErrorKind,
  retryAfterSeconds,
  waitMessage,
} from "@/lib/otp";
import { createClient } from "@/lib/supabase/client";

type EntrarFormProps = {
  next: string;
  code: string;
};

function flowParams(next: string, code: string) {
  const params = new URLSearchParams();

  if (next) {
    params.set("next", next);
  }

  if (code) {
    params.set("code", code);
  }

  return params;
}

export function EntrarForm({ next, code }: EntrarFormProps) {
  const router = useRouter();
  const online = useOnline();
  const [email, setEmail] = useState("");
  const [errorKind, setErrorKind] = useState<OtpErrorKind | null>(null);
  const [googleError, setGoogleError] = useState(false);
  const [networkFailed, setNetworkFailed] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [isGoogleLoading, setIsGoogleLoading] = useState(false);
  const [waitRemaining, restartWait] = useCountdown(0);

  useEffect(() => {
    const handleOnline = () => setNetworkFailed(false);
    window.addEventListener("online", handleOnline);
    return () => window.removeEventListener("online", handleOnline);
  }, []);

  const backParams = flowParams(next, code).toString();
  const backHref = backParams ? `/boas-vindas?${backParams}` : "/boas-vindas";
  const isOffline = !online;
  const isBusy = isSending || isGoogleLoading;

  async function handleGoogle() {
    setGoogleError(false);
    setErrorKind(null);
    setIsGoogleLoading(true);

    try {
      const supabase = createClient();
      const { error } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: {
          redirectTo: `${window.location.origin}${postLoginCallbackPath(next, code)}`,
        },
      });

      if (error) {
        throw error;
      }
    } catch (error) {
      if (otpSendErrorKind(error as OtpErrorLike) === "offline") {
        setNetworkFailed(true);
      } else {
        setGoogleError(true);
      }

      setIsGoogleLoading(false);
    }
  }

  async function handleEmail(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setGoogleError(false);

    if (!isValidEmail(email)) {
      setErrorKind("email_invalido");
      return;
    }

    const normalizedEmail = normalizeEmail(email);
    setErrorKind(null);
    setIsSending(true);

    let kind: OtpErrorKind | null = null;
    let waitSeconds: number | null = null;

    try {
      const supabase = createClient();
      const { error } = await supabase.auth.signInWithOtp({
        email: normalizedEmail,
        options: { shouldCreateUser: true },
      });

      if (error) {
        kind = otpSendErrorKind(error);
        waitSeconds = retryAfterSeconds(error);
      }
    } catch (error) {
      kind = otpSendErrorKind(error as OtpErrorLike);
    }

    if (!kind) {
      setNetworkFailed(false);
      const params = flowParams(next, code);
      params.set("email", normalizedEmail);
      router.push(`/entrar/codigo?${params.toString()}`);
      return;
    }

    setIsSending(false);

    if (kind === "offline") {
      setNetworkFailed(true);
      return;
    }

    if (kind === "aguarde") {
      restartWait(waitSeconds ?? RESEND_SECONDS);
    }

    setErrorKind(kind);
  }

  let emailMessage: string | null = null;

  if (errorKind === "aguarde") {
    emailMessage = waitRemaining > 0 ? waitMessage(waitRemaining) : null;
  } else if (errorKind) {
    emailMessage = OTP_COPY[errorKind];
  }

  return (
    <main className={SCREEN}>
      <BackLink href={backHref} />

      <section className="mt-2.5">
        <p className={EYEBROW}>Entrar</p>
        <h1 className={`${TITLE} mt-2.5`}>Como você quer entrar?</h1>
        <p className={`${SUBTITLE} mt-3`}>
          Cada um de vocês entra com a própria conta. Sem senha pra decorar.
        </p>
      </section>

      {isOffline || networkFailed ? (
        <div className="mt-5">
          <OfflineBanner />
        </div>
      ) : null}

      <button
        type="button"
        onClick={handleGoogle}
        disabled={isOffline || isBusy}
        className={`${BTN_WHITE} mt-[34px]`}
      >
        <GoogleIcon className="h-[22px] w-[22px]" />
        Continuar com Google
      </button>

      {googleError ? (
        <p role="alert" className="mt-3 text-center text-sm text-danger">
          {AUTH_ERROR_COPY.desconhecido}
        </p>
      ) : null}

      <OrDivider className="my-5" />

      <form
        noValidate
        onSubmit={handleEmail}
        className={`${CARD} p-4`}
      >
        <label htmlFor="email" className={LABEL}>
          Seu e-mail
        </label>
        <input
          id="email"
          name="email"
          type="email"
          inputMode="email"
          autoComplete="email"
          autoCapitalize="none"
          spellCheck={false}
          value={email}
          onChange={(event) => {
            setEmail(event.target.value);
            if (errorKind === "email_invalido") {
              setErrorKind(null);
            }
          }}
          aria-invalid={errorKind === "email_invalido"}
          aria-describedby="email-help"
          placeholder="voce@email.com"
          className={INPUT}
        />

        {emailMessage ? (
          <p role="alert" className={`${ERROR_TEXT} mt-2`}>
            {emailMessage}
          </p>
        ) : null}

        <button
          type="submit"
          disabled={isOffline || isBusy}
          className={`${BTN_SOFT_LG} mt-3`}
        >
          <span aria-hidden="true">✉️</span>
          Entrar com código no e-mail
        </button>

        <p id="email-help" className="mt-2.5 text-center text-[13px] text-ink/65">
          A gente manda um código de 6 números. Leva segundos.
        </p>
      </form>

      <p className="mt-7 text-center text-[12.5px] text-cream/55">
        Ao continuar, você concorda com os{" "}
        <Link href="/termos" className="underline-offset-2 hover:underline">
          Termos
        </Link>{" "}
        e a{" "}
        <Link href="/privacidade" className="underline-offset-2 hover:underline">
          Privacidade
        </Link>
        .
      </p>
    </main>
  );
}
