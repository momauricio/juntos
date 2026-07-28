"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { type FormEvent, useMemo, useState } from "react";

import { generateInviteCode, inviteExpiresAt } from "@/lib/invites";
import { createClient } from "@/lib/supabase/client";

const INVITE_ERROR_MESSAGES: Record<string, string> = {
  invalid_invite: "Convite inválido",
  invite_used: "Este convite já foi usado",
  invite_expired: "Este convite expirou",
  space_full: "Este espaço já tem 2 pessoas",
  already_in_space: "Você já está em um espaço",
  forbidden: "Você não pode alterar este convite",
};

function normalizeInviteCode(code: string) {
  return code.trim().toUpperCase();
}

function getInviteErrorMessage(
  error: { message?: string } | null,
  fallback = "Não foi possível usar este convite. Tente novamente.",
) {
  const message = error?.message ?? "";
  const key = Object.keys(INVITE_ERROR_MESSAGES).find((errorKey) =>
    message.includes(errorKey),
  );

  return key ? INVITE_ERROR_MESSAGES[key] : fallback;
}

function formatInviteExpiration(expiresAt: string | null) {
  if (!expiresAt) {
    return null;
  }

  const expiresDate = new Date(expiresAt);

  if (Number.isNaN(expiresDate.getTime())) {
    return null;
  }

  return new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "short",
    timeStyle: "short",
    timeZone: "America/Sao_Paulo",
  }).format(expiresDate);
}

type OnboardingInvitePanelProps = {
  initialCode?: string;
};

type SettingsInvitePanelProps = {
  variant: "settings";
  spaceId: string;
  origin: string;
  initialCode?: string | null;
  initialExpiresAt?: string | null;
};

type InvitePanelProps =
  | ({ variant?: "onboarding" } & OnboardingInvitePanelProps)
  | SettingsInvitePanelProps;

export function InvitePanel(props: InvitePanelProps) {
  if (props.variant === "settings") {
    return <SettingsInvitePanel {...props} />;
  }

  return <OnboardingInvitePanel initialCode={props.initialCode} />;
}

function OnboardingInvitePanel({
  initialCode = "",
}: OnboardingInvitePanelProps) {
  const router = useRouter();
  const [code, setCode] = useState(normalizeInviteCode(initialCode));
  const [createdInviteCode, setCreatedInviteCode] = useState<string | null>(
    null,
  );
  const [createError, setCreateError] = useState<string | null>(null);
  const [redeemError, setRedeemError] = useState<string | null>(null);
  const [copyStatus, setCopyStatus] = useState<string | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [isRedeeming, setIsRedeeming] = useState(false);

  const inviteLink = useMemo(() => {
    if (!createdInviteCode || typeof window === "undefined") {
      return null;
    }

    return `${window.location.origin}/onboarding?code=${createdInviteCode}`;
  }, [createdInviteCode]);

  async function handleCreateSpace() {
    setIsCreating(true);
    setCreateError(null);
    setCopyStatus(null);

    const supabase = createClient();
    const inviteCode = generateInviteCode();
    const expires = inviteExpiresAt().toISOString();
    const { data, error } = await supabase.rpc("create_space_with_invite", {
      p_name: "Nós dois",
      p_code: inviteCode,
      p_expires_at: expires,
    });

    if (error) {
      setCreateError(
        getInviteErrorMessage(
          error,
          "Não foi possível criar o espaço. Tente novamente.",
        ),
      );
      setIsCreating(false);
      return;
    }

    const returnedCode = Array.isArray(data)
      ? data[0]?.invite_code
      : data?.invite_code;

    setCreatedInviteCode(returnedCode ?? inviteCode);
    setIsCreating(false);
  }

  async function handleRedeemInvite(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const inviteCode = normalizeInviteCode(code);

    if (!inviteCode) {
      setRedeemError("Informe o código do convite.");
      return;
    }

    setIsRedeeming(true);
    setRedeemError(null);

    const supabase = createClient();
    const { error } = await supabase.rpc("redeem_invite", {
      p_code: inviteCode,
    });

    if (error) {
      setRedeemError(getInviteErrorMessage(error));
      setIsRedeeming(false);
      return;
    }

    router.push("/");
    router.refresh();
  }

  async function handleCopyInvite() {
    if (!inviteLink) {
      return;
    }

    try {
      await navigator.clipboard.writeText(inviteLink);
      setCopyStatus("Link copiado.");
    } catch {
      setCopyStatus("Copie o link manualmente.");
    }
  }

  return (
    <div className="grid gap-5 md:grid-cols-2">
      <section className="rounded-3xl bg-white p-6 shadow-sm ring-1 ring-stone-200">
        <div className="space-y-3">
          <p className="text-sm font-medium uppercase tracking-[0.2em] text-rose-500">
            Começar
          </p>
          <h2 className="text-2xl font-semibold tracking-tight">
            Crie o espaço de vocês
          </h2>
          <p className="text-sm leading-6 text-stone-600">
            Abra uma lista compartilhada para vocês dois e envie o convite para
            seu par entrar.
          </p>
        </div>

        <button
          type="button"
          disabled={isCreating || Boolean(createdInviteCode)}
          onClick={handleCreateSpace}
          className="mt-6 h-12 w-full rounded-2xl bg-rose-500 px-4 text-base font-semibold text-white transition hover:bg-rose-600 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {isCreating ? "Criando..." : "Criar nosso espaço"}
        </button>

        {createError ? (
          <p className="mt-4 rounded-2xl bg-red-50 px-4 py-3 text-sm text-red-700">
            {createError}
          </p>
        ) : null}

        {createdInviteCode && inviteLink ? (
          <div className="mt-5 space-y-4 rounded-2xl bg-rose-50 p-4">
            <div>
              <p className="text-sm font-medium text-stone-700">
                Código do convite
              </p>
              <p className="mt-1 font-mono text-3xl font-semibold tracking-[0.2em] text-rose-700">
                {createdInviteCode}
              </p>
            </div>

            <div>
              <p className="text-sm font-medium text-stone-700">
                Link para compartilhar
              </p>
              <p className="mt-1 break-all rounded-xl bg-white px-3 py-2 text-sm text-stone-700 ring-1 ring-rose-100">
                {inviteLink}
              </p>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <button
                type="button"
                onClick={handleCopyInvite}
                className="h-11 rounded-2xl bg-white px-4 text-sm font-semibold text-rose-600 ring-1 ring-rose-200 transition hover:bg-rose-100"
              >
                Copiar link
              </button>
              <Link
                href="/"
                className="flex h-11 items-center justify-center rounded-2xl bg-stone-900 px-4 text-sm font-semibold text-white transition hover:bg-stone-800"
              >
                Ir para a lista
              </Link>
            </div>

            {copyStatus ? (
              <p className="text-sm text-stone-600">{copyStatus}</p>
            ) : null}
          </div>
        ) : null}
      </section>

      <section className="rounded-3xl bg-white p-6 shadow-sm ring-1 ring-stone-200">
        <div className="space-y-3">
          <p className="text-sm font-medium uppercase tracking-[0.2em] text-rose-500">
            Convite
          </p>
          <h2 className="text-2xl font-semibold tracking-tight">
            Entre em um espaço
          </h2>
          <p className="text-sm leading-6 text-stone-600">
            Já recebeu um código? Use aqui para entrar na lista criada pelo seu
            par.
          </p>
        </div>

        <form className="mt-6 space-y-4" onSubmit={handleRedeemInvite}>
          <div className="space-y-2">
            <label className="text-sm font-medium text-stone-800" htmlFor="code">
              Código do convite
            </label>
            <input
              id="code"
              name="code"
              type="text"
              inputMode="text"
              autoComplete="one-time-code"
              value={code}
              onChange={(event) =>
                setCode(normalizeInviteCode(event.target.value))
              }
              className="h-12 w-full rounded-2xl border border-stone-300 bg-white px-4 font-mono text-base uppercase tracking-[0.2em] outline-none transition focus:border-rose-500 focus:ring-4 focus:ring-rose-100"
              placeholder="ABCDEFGH"
            />
          </div>

          {redeemError ? (
            <p className="rounded-2xl bg-red-50 px-4 py-3 text-sm text-red-700">
              {redeemError}
            </p>
          ) : null}

          <button
            type="submit"
            disabled={isRedeeming}
            className="h-12 w-full rounded-2xl bg-stone-900 px-4 text-base font-semibold text-white transition hover:bg-stone-800 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isRedeeming ? "Entrando..." : "Usar convite"}
          </button>
        </form>
      </section>
    </div>
  );
}

function SettingsInvitePanel({
  spaceId,
  origin,
  initialCode = null,
  initialExpiresAt = null,
}: SettingsInvitePanelProps) {
  const router = useRouter();
  const [currentCode, setCurrentCode] = useState<string | null>(() =>
    initialCode ? normalizeInviteCode(initialCode) : null,
  );
  const [expiresAt, setExpiresAt] = useState<string | null>(initialExpiresAt);
  const [error, setError] = useState<string | null>(null);
  const [copyStatus, setCopyStatus] = useState<string | null>(null);
  const [isRegenerating, setIsRegenerating] = useState(false);

  const inviteLink = useMemo(() => {
    if (!currentCode || !origin) {
      return null;
    }

    return `${origin}/onboarding?code=${currentCode}`;
  }, [currentCode, origin]);

  const formattedExpiration = useMemo(
    () => formatInviteExpiration(expiresAt),
    [expiresAt],
  );

  async function handleRegenerateInvite() {
    setIsRegenerating(true);
    setError(null);
    setCopyStatus(null);

    const supabase = createClient();
    const inviteCode = generateInviteCode();
    const expires = inviteExpiresAt().toISOString();
    const { data, error: regenerateError } = await supabase.rpc(
      "regenerate_invite",
      {
        p_space_id: spaceId,
        p_code: inviteCode,
        p_expires_at: expires,
      },
    );

    if (regenerateError) {
      setError(
        getInviteErrorMessage(
          regenerateError,
          "Não foi possível gerar um novo convite. Tente novamente.",
        ),
      );
      setIsRegenerating(false);
      return;
    }

    setCurrentCode(typeof data === "string" ? data : inviteCode);
    setExpiresAt(expires);
    setIsRegenerating(false);
    router.refresh();
  }

  async function handleCopyInvite() {
    if (!inviteLink) {
      return;
    }

    try {
      await navigator.clipboard.writeText(inviteLink);
      setCopyStatus("Link copiado.");
    } catch {
      setCopyStatus("Copie o link manualmente.");
    }
  }

  return (
    <section className="rounded-3xl bg-white p-6 shadow-sm ring-1 ring-stone-200">
      <div className="space-y-3">
        <p className="text-sm font-medium uppercase tracking-[0.2em] text-rose-500">
          Convite
        </p>
        <h2 className="text-2xl font-semibold tracking-tight">
          Convide seu par
        </h2>
        <p className="text-sm leading-6 text-stone-600">
          Compartilhe o código ativo ou gere um novo convite para invalidar o
          anterior.
        </p>
      </div>

      {currentCode ? (
        <div className="mt-5 space-y-4 rounded-2xl bg-rose-50 p-4">
          <div>
            <p className="text-sm font-medium text-stone-700">
              Código do convite
            </p>
            <p className="mt-1 font-mono text-3xl font-semibold tracking-[0.2em] text-rose-700">
              {currentCode}
            </p>
            {formattedExpiration ? (
              <p className="mt-2 text-sm text-stone-600">
                Expira em {formattedExpiration}
              </p>
            ) : null}
          </div>

          {inviteLink ? (
            <div>
              <p className="text-sm font-medium text-stone-700">
                Link para compartilhar
              </p>
              <p className="mt-1 break-all rounded-xl bg-white px-3 py-2 text-sm text-stone-700 ring-1 ring-rose-100">
                {inviteLink}
              </p>
            </div>
          ) : null}

          {inviteLink ? (
            <button
              type="button"
              onClick={handleCopyInvite}
              className="h-11 rounded-2xl bg-white px-4 text-sm font-semibold text-rose-600 ring-1 ring-rose-200 transition hover:bg-rose-100"
            >
              Copiar link
            </button>
          ) : null}

          {copyStatus ? (
            <p className="text-sm text-stone-600">{copyStatus}</p>
          ) : null}
        </div>
      ) : (
        <p className="mt-5 rounded-2xl bg-stone-50 px-4 py-3 text-sm text-stone-600 ring-1 ring-stone-200">
          Ainda não há um convite ativo.
        </p>
      )}

      {error ? (
        <p className="mt-4 rounded-2xl bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </p>
      ) : null}

      <button
        type="button"
        disabled={isRegenerating}
        onClick={handleRegenerateInvite}
        className="mt-5 h-12 w-full rounded-2xl bg-rose-500 px-4 text-base font-semibold text-white transition hover:bg-rose-600 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {isRegenerating ? "Gerando..." : "Gerar novo convite"}
      </button>
    </section>
  );
}
