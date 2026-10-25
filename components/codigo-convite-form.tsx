"use client";

import { useRouter } from "next/navigation";
import { type FormEvent, useState } from "react";

import { useOnline } from "@/components/auth-hooks";
import { BackLink, OfflineBanner } from "@/components/auth-ui";
import {
  BTN_PRIMARY,
  CARD,
  ERROR_TEXT,
  LABEL,
  SCREEN,
  TITLE,
} from "@/components/ui-classes";
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
    <main className={SCREEN}>
      <BackLink href="/onboarding/nome" />

      <section className="mt-2.5">
        <h1 className={TITLE}>Entrar com convite</h1>
      </section>

      {!online ? (
        <div className="mt-5">
          <OfflineBanner />
        </div>
      ) : null}

      <form onSubmit={handleSubmit} noValidate>
        <div className={`${CARD} mt-[26px]`}>
          <label htmlFor="invite_code" className={LABEL}>
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
            className="h-[50px] w-full rounded-xl border border-ink/20 bg-[#fbf7f2] px-3.5 font-mono text-lg uppercase tracking-[0.2em] text-ink outline-none transition focus:border-accent focus:ring-4 focus:ring-accent-soft"
          />
          <p id="invite_code-help" className="mt-2 text-[13px] text-ink/65">
            Seu par encontra o código em Chamar meu par.
          </p>
          {error ? (
            <p role="alert" className={`${ERROR_TEXT} mt-3`}>
              {error}
            </p>
          ) : null}
        </div>

        <button
          type="submit"
          disabled={!normalized || !online || isChecking}
          className={`${BTN_PRIMARY} mt-[26px]`}
        >
          Entrar no espaço
        </button>
      </form>
    </main>
  );
}
