"use client";

import Link from "next/link";
import { type FormEvent, useActionState, useState } from "react";

import { GoogleIcon } from "@/components/auth-ui";
import { StepProgress } from "@/components/step-progress";
import {
  BTN_PRIMARY,
  CARD,
  ERROR_TEXT,
  INPUT,
  LABEL,
  SCREEN,
  STEP_LABEL,
  SUBTITLE,
  TEXT_LINK_QUIET,
  TITLE,
} from "@/components/ui-classes";
import {
  DISPLAY_NAME_MAX,
  SPACE_NAME_MAX,
  validateDisplayName,
} from "@/lib/display-name";

export type NomeFormState = {
  error: string | null;
};

type NomeFormProps = {
  saveAction: (
    state: NomeFormState,
    formData: FormData,
  ) => Promise<NomeFormState>;
  skipAction: () => Promise<void>;
  // "creator" cria o espaço; "guest" acabou de entrar no espaço do par.
  variant: "creator" | "guest";
  initialName: string;
  // Primeiro nome vindo do Google; vazio no login por código.
  googleName: string;
};

const INITIAL_STATE: NomeFormState = { error: null };

export function NomeForm({
  saveAction,
  skipAction,
  variant,
  initialName,
  googleName,
}: NomeFormProps) {
  const [state, formAction, isPending] = useActionState(
    saveAction,
    INITIAL_STATE,
  );
  const [name, setName] = useState(initialName);
  const [spaceName, setSpaceName] = useState("");
  const isCreator = variant === "creator";
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
    <main className={SCREEN}>
      <div
        className={`flex items-center ${isCreator ? "justify-between" : "justify-end"}`}
      >
        {isCreator ? (
          <p className={STEP_LABEL}>Passo 1 de 3</p>
        ) : null}
        <form action={skipAction}>
          <button
            type="submit"
            className="min-h-11 text-sm text-cream/70 transition hover:text-cream"
          >
            Pular
          </button>
        </form>
      </div>

      {isCreator ? <StepProgress step={1} /> : null}

      <section className={isCreator ? "mt-7" : "mt-4"}>
        <h1 className={TITLE}>Prazer! Como você se chama?</h1>
        <p className={`${SUBTITLE} mt-3`}>
          É assim que seu par vai ver o que você adicionar.
        </p>
      </section>

      <form action={formAction} onSubmit={handleSubmit} noValidate>
        <div className={`${CARD} mt-[26px]`}>
          <label htmlFor="display_name" className={LABEL}>
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
              className={`${INPUT} ${showGoogleBadge ? "pr-28" : ""}`}
            />
            {showGoogleBadge ? (
              <span className="pointer-events-none absolute inset-y-0 right-3.5 flex items-center gap-1.5 text-xs font-semibold text-ink/55">
                <GoogleIcon className="h-3.5 w-3.5" />
                do Google
              </span>
            ) : null}
          </div>

          {isCreator ? (
            <>
              <label
                htmlFor="space_name"
                className={`${LABEL} mt-5`}
              >
                Como chamamos vocês dois?{" "}
                <span className="font-normal text-ink/65">
                  (opcional)
                </span>
              </label>
              <input
                id="space_name"
                name="space_name"
                type="text"
                autoComplete="off"
                maxLength={SPACE_NAME_MAX}
                value={spaceName}
                onChange={(event) => setSpaceName(event.target.value)}
                placeholder={`Ex.: ${name.trim() || "…"} & …`}
                aria-describedby="space_name-help"
                className={INPUT}
              />
              <p id="space_name-help" className="mt-2 text-[13px] text-ink/65">
                Aparece no topo do quadro de vocês. Dá pra mudar depois.
              </p>
            </>
          ) : null}

          {error ? (
            <p role="alert" className={`${ERROR_TEXT} mt-3`}>
              {error}
            </p>
          ) : null}
        </div>

        <button
          type="submit"
          disabled={isPending}
          className={`${BTN_PRIMARY} mt-[26px]`}
        >
          {isPending
            ? "Salvando..."
            : isCreator
              ? "Continuar"
              : "Entrar no espaço"}
        </button>
      </form>

      {isCreator ? (
        <Link
          href="/onboarding/codigo"
          className={`${TEXT_LINK_QUIET} mt-6`}
        >
          Recebeu um convite? Digite o código
        </Link>
      ) : null}
    </main>
  );
}
