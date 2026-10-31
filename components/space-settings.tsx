"use client";

import { useRouter } from "next/navigation";
import { type FormEvent, useState } from "react";

import { useOnline } from "@/components/auth-hooks";
import { OfflineBanner } from "@/components/auth-ui";
import { SPACE_NAME_MAX } from "@/lib/display-name";
import { inviteErrorMessage } from "@/lib/invites";
import { createClient } from "@/lib/supabase/client";

type SpaceNameFormProps = {
  name: string | null;
  computedName: string;
};

export function SpaceNameForm({ name, computedName }: SpaceNameFormProps) {
  const router = useRouter();
  const online = useOnline();
  const [value, setValue] = useState(name ?? "");
  const [isPending, setIsPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsPending(true);
    setError(null);

    try {
      const { error: rpcError } = await createClient().rpc("rename_space", {
        p_name: value.trim() || null,
      });

      if (rpcError) {
        throw rpcError;
      }

      router.refresh();
    } catch (caught) {
      setError(inviteErrorMessage(caught as { message?: string }));
    }

    setIsPending(false);
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      <label
        htmlFor="space_name"
        className="block text-sm font-medium text-foreground/70"
      >
        Como chamamos vocês dois?
      </label>
      <div className="flex gap-3">
        <input
          id="space_name"
          name="space_name"
          type="text"
          maxLength={SPACE_NAME_MAX}
          value={value}
          onChange={(event) => setValue(event.target.value)}
          placeholder={computedName}
          className="h-12 min-w-0 flex-1 rounded-2xl border border-border bg-surface px-4 text-base text-[#1a2238] outline-none transition focus:border-accent focus:ring-4 focus:ring-accent-soft"
        />
        <button
          type="submit"
          disabled={!online || isPending}
          className="h-12 rounded-2xl bg-foreground px-5 text-base font-semibold text-surface transition hover:bg-accent-strong disabled:cursor-not-allowed disabled:opacity-60"
        >
          Salvar
        </button>
      </div>
      {!online ? <OfflineBanner /> : null}
      {error ? (
        <p role="alert" className="text-sm text-danger">
          {error}
        </p>
      ) : null}
    </form>
  );
}

type LeaveSpaceProps = {
  partnerName: string | null;
  itemCount: number;
};

export function LeaveSpace({ partnerName, itemCount }: LeaveSpaceProps) {
  const router = useRouter();
  const online = useOnline();
  const [confirming, setConfirming] = useState(false);
  const [isPending, setIsPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleLeave() {
    setIsPending(true);
    setError(null);

    try {
      const { error: rpcError } = await createClient().rpc("leave_space");

      if (rpcError) {
        throw rpcError;
      }

      router.replace("/onboarding/nome");
      router.refresh();
    } catch (caught) {
      setError(inviteErrorMessage(caught as { message?: string }));
      setIsPending(false);
    }
  }

  if (!confirming) {
    return (
      <button
        type="button"
        onClick={() => setConfirming(true)}
        className="h-12 w-full rounded-2xl px-4 text-base font-semibold text-danger ring-1 ring-border transition hover:bg-foreground/5"
      >
        Sair do espaço
      </button>
    );
  }

  return (
    <div className="space-y-4 rounded-2xl bg-surface-muted p-4 text-[#1a2238] ring-1 ring-border">
      <p className="text-base leading-7">
        {partnerName
          ? `Sair do espaço de vocês? Os lugares continuam com ${partnerName}. Você pode voltar se ${partnerName} te chamar de novo.`
          : `Você é a última pessoa aqui. Sair apaga o espaço e os ${itemCount} lugares. Tem certeza?`}
      </p>
      {!online ? <OfflineBanner /> : null}
      {error ? (
        <p role="alert" className="text-sm text-danger">
          {error}
        </p>
      ) : null}
      <div className="grid grid-cols-2 gap-3">
        <button
          type="button"
          disabled={!online || isPending}
          onClick={handleLeave}
          className="h-12 rounded-2xl bg-accent px-4 text-base font-semibold text-accent-contrast transition hover:brightness-110 disabled:opacity-60"
        >
          {partnerName ? "Sair" : "Apagar e sair"}
        </button>
        <button
          type="button"
          disabled={isPending}
          onClick={() => setConfirming(false)}
          className="h-12 rounded-2xl bg-surface px-4 text-base font-semibold ring-1 ring-border transition hover:bg-surface-strong disabled:opacity-60"
        >
          Ficar
        </button>
      </div>
    </div>
  );
}
