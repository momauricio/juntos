"use client";

import { type FormEvent, useActionState, useState } from "react";

import { GoogleIcon } from "@/components/auth-ui";
import { DISPLAY_NAME_MAX, validateDisplayName } from "@/lib/display-name";

export type NomeFormState = {
  error: string | null;
};

type NomeFormProps = {
  saveAction: (
    state: NomeFormState,
    formData: FormData,
  ) => Promise<NomeFormState>;
  skipAction: () => Promise<void>;
  // Primeiro nome vindo do Google; vazio no login por código.
  googleName: string;
};

const INITIAL_STATE: NomeFormState = { error: null };

export function NomeForm({ saveAction, skipAction, googleName }: NomeFormProps) {
  const [state, formAction, isPending] = useActionState(
    saveAction,
    INITIAL_STATE,
  );
  const [name, setName] = useState(googleName);
  const [clientError, setClientError] = useState<string | null>(null);
  const showGoogleBadge = Boolean(googleName) && name === googleName;
  const error = clientError ?? state.error;

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    const result = validateDisplayName(name);

    if (!result.ok) {
      event.preventDefault();
      setClientError(result.error);
      return;
    }

    setClientError(null);
  }

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-md flex-col px-6 pb-10 pt-8 text-foreground">
      <div className="flex items-center justify-between">
        <p className="text-lg text-foreground/70">Passo 1 de 3</p>
        <form action={skipAction}>
          <button
            type="submit"
            className="h-11 text-lg text-foreground/70 transition hover:text-foreground"
          >
            Pular
          </button>
        </form>
      </div>

      <div
        role="progressbar"
        aria-label="Passo 1 de 3"
        aria-valuemin={1}
        aria-valuemax={3}
        aria-valuenow={1}
        className="mt-3 grid grid-cols-3 gap-3"
      >
        <span className="h-2 rounded-full bg-accent" />
        <span className="h-2 rounded-full bg-foreground/20" />
        <span className="h-2 rounded-full bg-foreground/20" />
      </div>

      <section className="mt-10 space-y-4">
        <h1 className="font-serif text-4xl font-semibold leading-tight tracking-tight sm:text-5xl">
          Prazer! Como você se chama?
        </h1>
        <p className="text-lg leading-8 text-foreground/70">
          É assim que seu par vai ver o que você adicionar.
        </p>
      </section>

      <form action={formAction} onSubmit={handleSubmit} noValidate>
        <div className="mt-8 space-y-3 rounded-[28px] bg-surface p-6">
          <label htmlFor="display_name" className="block text-base font-semibold">
            Seu nome
          </label>
          <div className="relative">
            <input
              id="display_name"
              name="display_name"
              type="text"
              autoComplete="given-name"
              maxLength={DISPLAY_NAME_MAX}
              value={name}
              onChange={(event) => {
                setName(event.target.value);
                setClientError(null);
              }}
              aria-invalid={Boolean(error)}
              className={`h-14 w-full rounded-2xl border border-[#1a2238]/15 bg-[#fbf8f4] px-4 text-lg outline-none transition focus:border-accent focus:ring-4 focus:ring-accent-soft ${
                showGoogleBadge ? "pr-32" : ""
              }`}
            />
            {showGoogleBadge ? (
              <span className="pointer-events-none absolute inset-y-0 right-4 flex items-center gap-1.5 text-sm font-semibold text-[#1a2238]/60">
                <GoogleIcon className="h-5 w-5" />
                do Google
              </span>
            ) : null}
          </div>

          {/* TODO(PR6): campo "Como chamamos vocês dois? (opcional)" com
              placeholder "Ex.: {Eu} & …" e a ajuda "Aparece no topo do quadro
              de vocês. Dá pra mudar depois." — depende do espaço existir. */}

          {error ? (
            <p role="alert" className="text-sm font-medium text-[#a3402a]">
              {error}
            </p>
          ) : null}
        </div>

        <button
          type="submit"
          disabled={isPending}
          className="mt-6 flex h-14 w-full items-center justify-center rounded-3xl bg-accent px-4 text-lg font-semibold text-accent-contrast shadow-lg shadow-accent/30 transition hover:brightness-110 disabled:opacity-60"
        >
          {isPending ? "Salvando..." : "Continuar"}
        </button>
      </form>
    </main>
  );
}
