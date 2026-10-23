"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { useOnline } from "@/components/auth-hooks";
import { GoogleIcon, OfflineBanner } from "@/components/auth-ui";
import {
  AUTH_ERROR_COPY,
  postLoginCallbackPath,
  signInPathWithNext,
} from "@/lib/auth-callback";
import { HOST_FALLBACK, inviteErrorMessage } from "@/lib/invites";
import { createClient } from "@/lib/supabase/client";

const PRIMARY_BUTTON =
  "flex h-14 w-full items-center justify-center gap-3 rounded-3xl bg-accent px-4 text-lg font-semibold text-accent-contrast shadow-lg shadow-accent/30 transition hover:brightness-110 disabled:opacity-60";
const SECONDARY_BUTTON =
  "flex h-14 w-full items-center justify-center gap-2 rounded-3xl border border-foreground/30 px-4 text-lg font-semibold transition hover:bg-foreground/5 disabled:opacity-60";

function onboardingNext(code: string) {
  return `/onboarding?code=${encodeURIComponent(code)}`;
}

function ErrorText({ children }: { children: React.ReactNode }) {
  return (
    <p role="alert" className="text-center text-sm font-medium text-danger">
      {children}
    </p>
  );
}

// Tela 7, deslogada: Google ou código no e-mail, voltando para o convite.
export function InviteSignInActions({ code }: { code: string }) {
  const online = useOnline();
  const [isLoading, setIsLoading] = useState(false);
  const [failed, setFailed] = useState(false);
  const next = onboardingNext(code);

  async function handleGoogle() {
    setFailed(false);
    setIsLoading(true);

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
    } catch {
      setFailed(true);
      setIsLoading(false);
    }
  }

  return (
    <div className="mt-auto space-y-4 pt-10">
      {!online ? <OfflineBanner /> : null}
      <button
        type="button"
        onClick={handleGoogle}
        disabled={!online || isLoading}
        className="flex h-14 w-full items-center justify-center gap-3 rounded-3xl bg-surface px-4 text-lg font-semibold text-[#1a2238] transition hover:bg-cream disabled:opacity-60"
      >
        <GoogleIcon />
        Continuar com Google
      </button>
      {failed ? <ErrorText>{AUTH_ERROR_COPY.desconhecido}</ErrorText> : null}
      {online ? (
        <Link href={signInPathWithNext(next, code)} className={SECONDARY_BUTTON}>
          <span aria-hidden="true">✉️</span>
          Entrar com código no e-mail
        </Link>
      ) : (
        <button type="button" disabled className={SECONDARY_BUTTON}>
          <span aria-hidden="true">✉️</span>
          Entrar com código no e-mail
        </button>
      )}
    </div>
  );
}

type RedeemProps = {
  code: string;
  host: string | null;
  successPath: string;
};

function useRedeem({ host, successPath }: RedeemProps) {
  const router = useRouter();
  const online = useOnline();
  const [isPending, setIsPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function run(call: () => PromiseLike<{ error: { message: string } | null }>) {
    setIsPending(true);
    setError(null);

    try {
      const { error: rpcError } = await call();

      if (rpcError) {
        throw rpcError;
      }

      router.replace(successPath);
      router.refresh();
    } catch (caught) {
      setError(inviteErrorMessage(caught as { message?: string }, host));
      setIsPending(false);
    }
  }

  return { online, isPending, error, run };
}

// Tela 7, logada sem espaço: entrar direto.
export function InviteJoinActions(props: RedeemProps) {
  const router = useRouter();
  const { online, isPending, error, run } = useRedeem(props);
  const host = props.host?.trim() || HOST_FALLBACK;

  async function handleSwitchAccount() {
    await createClient().auth.signOut();
    router.replace(`/c/${encodeURIComponent(props.code)}`);
    router.refresh();
  }

  return (
    <div className="mt-auto space-y-4 pt-10">
      {!online ? <OfflineBanner /> : null}
      <button
        type="button"
        disabled={!online || isPending}
        onClick={() =>
          run(() => createClient().rpc("redeem_invite", { p_code: props.code }))
        }
        className={PRIMARY_BUTTON}
      >
        Entrar no espaço de {host}
      </button>
      {error ? <ErrorText>{error}</ErrorText> : null}
      <button
        type="button"
        disabled={!online || isPending}
        onClick={handleSwitchAccount}
        className="mx-auto block h-11 text-lg text-foreground/70 underline underline-offset-4 transition hover:text-foreground disabled:opacity-60"
      >
        Trocar de conta
      </button>
    </div>
  );
}

// Tela 7, logada num espaço só dela: trazer os lugares ou apagar o antigo.
export function InviteSwitchActions(props: RedeemProps) {
  const { online, isPending, error, run } = useRedeem(props);

  function handleSwitch(bringItems: boolean) {
    return run(() =>
      createClient().rpc("switch_space_and_redeem", {
        p_code: props.code,
        p_bring_items: bringItems,
      }),
    );
  }

  return (
    <div className="mt-auto space-y-4 pt-10">
      {!online ? <OfflineBanner /> : null}
      <button
        type="button"
        disabled={!online || isPending}
        onClick={() => handleSwitch(true)}
        className={PRIMARY_BUTTON}
      >
        Trazer e entrar
      </button>
      <button
        type="button"
        disabled={!online || isPending}
        onClick={() => handleSwitch(false)}
        className={SECONDARY_BUTTON}
      >
        Entrar sem trazer (apaga o meu)
      </button>
      {error ? <ErrorText>{error}</ErrorText> : null}
      <Link
        href="/"
        className="mx-auto block w-fit text-lg text-foreground/70 underline underline-offset-4 transition hover:text-foreground"
      >
        Agora não
      </Link>
    </div>
  );
}
