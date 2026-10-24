import type { Metadata } from "next";
import Link from "next/link";

import {
  AUTH_ERROR_COPY,
  AUTH_ERROR_TITLE,
  parseAuthErrorReason,
  signInPathWithNext,
} from "@/lib/auth-callback";

export const metadata: Metadata = {
  title: "Erro ao entrar",
};

type AuthErrorPageProps = {
  searchParams: Promise<{
    motivo?: string | string[];
    next?: string | string[];
  }>;
};

function firstParam(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

export default async function AuthErrorPage({
  searchParams,
}: AuthErrorPageProps) {
  const params = await searchParams;
  const reason = parseAuthErrorReason(firstParam(params.motivo));

  return (
    <main className="flex min-h-dvh items-center justify-center px-4 py-10 text-foreground">
      <section className="w-full max-w-sm rounded-3xl bg-surface p-6 ring-1 ring-border">
        <div className="space-y-3 text-center">
          <p className="text-sm font-semibold uppercase tracking-[0.18em] text-accent">
            Entrar
          </p>
          <h1 className="font-serif text-4xl font-semibold tracking-tight">
            {AUTH_ERROR_TITLE}
          </h1>
          <p className="text-base leading-7 text-foreground/70">
            {AUTH_ERROR_COPY[reason]}
          </p>
        </div>

        <Link
          href={signInPathWithNext(firstParam(params.next))}
          className="mt-8 flex h-12 w-full items-center justify-center rounded-2xl bg-accent-strong px-4 text-base font-semibold text-accent-contrast transition hover:bg-accent"
        >
          Voltar para entrar
        </Link>
      </section>
    </main>
  );
}
