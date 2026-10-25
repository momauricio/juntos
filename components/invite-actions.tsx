"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { useOnline } from "@/components/auth-hooks";
import { GoogleIcon, OfflineBanner } from "@/components/auth-ui";
import {
  BTN_OUTLINE_LG,
  BTN_PRIMARY,
  BTN_WHITE,
  TEXT_LINK_QUIET,
} from "@/components/ui-classes";
import {
  AUTH_ERROR_COPY,
  postLoginCallbackPath,
  signInPathWithNext,
} from "@/lib/auth-callback";
import {
  HOST_FALLBACK,
  type InviteErrorAction,
  inviteErrorAction,
  inviteErrorMessage,
} from "@/lib/invites";
import { createClient } from "@/lib/supabase/client";

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

type RedeemError = { message: string; action: InviteErrorAction | null };

function RedeemErrorBlock({ error }: { error: RedeemError | null }) {
  if (!error) {
    return null;
  }

  return (
    <>
      <ErrorText>{error.message}</ErrorText>
      {error.action ? (
        <Link href={error.action.href} className={BTN_OUTLINE_LG}>
          {error.action.label}
        </Link>
      ) : null}
    </>
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
    <div className="mt-auto space-y-3 pt-8">
      {!online ? <OfflineBanner /> : null}
      <button
        type="button"
        onClick={handleGoogle}
        disabled={!online || isLoading}
        className={BTN_WHITE}
      >
        <GoogleIcon className="h-[22px] w-[22px]" />
        Continuar com Google
      </button>
      {failed ? <ErrorText>{AUTH_ERROR_COPY.desconhecido}</ErrorText> : null}
      {online ? (
        <Link href={signInPathWithNext(next, code)} className={BTN_OUTLINE_LG}>
          <span aria-hidden="true">✉️</span>
          Entrar com código no e-mail
        </Link>
      ) : (
        <button type="button" disabled className={BTN_OUTLINE_LG}>
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
  const [error, setError] = useState<RedeemError | null>(null);

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
      const rpcError = caught as { message?: string };
      setError({
        message: inviteErrorMessage(rpcError, host),
        action: inviteErrorAction(rpcError),
      });
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
    <div className="mt-auto space-y-3 pt-8">
      {!online ? <OfflineBanner /> : null}
      <button
        type="button"
        disabled={!online || isPending}
        onClick={() =>
          run(() => createClient().rpc("redeem_invite", { p_code: props.code }))
        }
        className={BTN_PRIMARY}
      >
        Entrar no espaço de {host}
      </button>
      <RedeemErrorBlock error={error} />
      <button
        type="button"
        disabled={!online || isPending}
        onClick={handleSwitchAccount}
        className={BTN_OUTLINE_LG}
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
    <div className="mt-auto space-y-3 pt-8">
      {!online ? <OfflineBanner /> : null}
      <button
        type="button"
        disabled={!online || isPending}
        onClick={() => handleSwitch(true)}
        className={BTN_PRIMARY}
      >
        Trazer e entrar
      </button>
      <button
        type="button"
        disabled={!online || isPending}
        onClick={() => handleSwitch(false)}
        className={BTN_OUTLINE_LG}
      >
        Entrar sem trazer (apaga o meu)
      </button>
      <RedeemErrorBlock error={error} />
      <Link
        href="/"
        className={TEXT_LINK_QUIET}
      >
        Agora não
      </Link>
    </div>
  );
}
