"use client";

import { useRouter } from "next/navigation";
import { type FormEvent, useState } from "react";

import { useOnline } from "@/components/auth-hooks";
import { BackLink, OfflineBanner } from "@/components/auth-ui";
import {
  INVITE_UNKNOWN_ERROR,
  type InvitePreview,
  inviteCodeStatusError,
  normalizeInviteCode,
} from "@/lib/invites";
import { createClient } from "@/lib/supabase/client";

// Para quem recebeu o código do convite em vez do link.
export function CodigoConviteForm() {
  const router = useRouter();
  const online = useOnline();
  const [code, setCode] = useState("");
  const [isChecking, setIsChecking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const normalized = normalizeInviteCode(code);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!normalized || !online) {
      return;
    }

    setIsChecking(true);
    setError(null);

    try {
      const { data, error: rpcError } = await createClient().rpc(
        "invite_preview",
        { p_code: normalized },
      );

      if (rpcError || !data) {
        throw rpcError;
      }

      const statusError = inviteCodeStatusError(
        (data as InvitePreview).status,
      );

      if (statusError) {
        setError(statusError);
        setIsChecking(false);
        return;
      }

      router.push(`/c/${encodeURIComponent(normalized)}`);
    } catch {
      setError(INVITE_UNKNOWN_ERROR);
      setIsChecking(false);
    }
  }

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-md flex-col px-6 pb-10 pt-8 text-foreground">
      <BackLink href="/onboarding/nome" />

      <section className="mt-8 space-y-4">
        <h1 className="font-serif text-4xl font-semibold leading-tight tracking-tight sm:text-5xl">
          Entrar com convite
        </h1>
      </section>

      {!online ? (
        <div className="mt-6">
          <OfflineBanner />
        </div>
      ) : null}

      <form onSubmit={handleSubmit} noValidate>
        <div className="mt-8 space-y-3 rounded-[28px] bg-surface p-6">
          <label htmlFor="invite_code" className="block text-base font-semibold">
            Código do convite
          </label>
          <input
            id="invite_code"
            name="invite_code"
            type="text"
            autoComplete="off"
            autoCapitalize="characters"
            spellCheck={false}
            maxLength={12}
            value={code}
            onChange={(event) => {
              setCode(event.target.value);
              setError(null);
            }}
            placeholder="XXXX-XXXX"
            aria-invalid={Boolean(error)}
            aria-describedby="invite_code-help"
            className="h-14 w-full rounded-2xl border border-[#1a2238]/15 bg-[#fbf8f4] px-4 font-mono text-lg uppercase tracking-[0.2em] outline-none transition placeholder:text-[#1a2238]/40 focus:border-accent focus:ring-4 focus:ring-accent-soft"
          />
          <p id="invite_code-help" className="text-[#1a2238]/65">
            Seu par encontra o código em Chamar meu par.
          </p>
          {error ? (
            <p role="alert" className="text-sm font-medium text-[#a3402a]">
              {error}
            </p>
          ) : null}
        </div>

        <button
          type="submit"
          disabled={!normalized || !online || isChecking}
          className="mt-6 flex h-14 w-full items-center justify-center rounded-3xl bg-accent px-4 text-lg font-semibold text-accent-contrast shadow-lg shadow-accent/30 transition hover:brightness-110 disabled:opacity-60"
        >
          Entrar no espaço
        </button>
      </form>
    </main>
  );
}
