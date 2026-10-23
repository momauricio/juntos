"use client";

import { useRouter } from "next/navigation";
import { type FormEvent, useState } from "react";

import { BackLink } from "@/components/auth-ui";
import { normalizeInviteCode } from "@/lib/invites";

// Para quem recebeu o "Código de reserva" em vez do link.
export function CodigoConviteForm() {
  const router = useRouter();
  const [code, setCode] = useState("");
  const normalized = normalizeInviteCode(code);

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (normalized) {
      router.push(`/c/${encodeURIComponent(normalized)}`);
    }
  }

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-md flex-col px-6 pb-10 pt-8 text-foreground">
      <BackLink href="/onboarding/nome" />

      <section className="mt-8 space-y-4">
        <h1 className="font-serif text-4xl font-semibold leading-tight tracking-tight sm:text-5xl">
          Tem um código?
        </h1>
      </section>

      <form onSubmit={handleSubmit} noValidate>
        <div className="mt-8 space-y-3 rounded-[28px] bg-surface p-6">
          <label htmlFor="invite_code" className="block text-base font-semibold">
            Código de convite
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
            onChange={(event) => setCode(event.target.value)}
            placeholder="ABCD-2345"
            className="h-14 w-full rounded-2xl border border-[#1a2238]/15 bg-[#fbf8f4] px-4 font-mono text-lg uppercase tracking-[0.2em] outline-none transition placeholder:text-[#1a2238]/40 focus:border-accent focus:ring-4 focus:ring-accent-soft"
          />
        </div>

        <button
          type="submit"
          disabled={!normalized}
          className="mt-6 flex h-14 w-full items-center justify-center rounded-3xl bg-accent px-4 text-lg font-semibold text-accent-contrast shadow-lg shadow-accent/30 transition hover:brightness-110 disabled:opacity-60"
        >
          Continuar
        </button>
      </form>
    </main>
  );
}
