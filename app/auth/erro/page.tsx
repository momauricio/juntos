import type { Metadata } from "next";
import Link from "next/link";

import { BTN_PRIMARY, CARD, EYEBROW_ACCENT } from "@/components/ui-classes";
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
    <main className="flex min-h-dvh items-center justify-center px-5 py-10 text-foreground">
      <section className={`${CARD} w-full max-w-sm p-6`}>
        <div className="space-y-3 text-center">
          <p className={EYEBROW_ACCENT}>Entrar</p>
          <h1 className="text-[28px] font-medium leading-[1.15] text-ink">
            {AUTH_ERROR_TITLE}
          </h1>
          <p className="text-base leading-[1.55] text-ink/70">
            {AUTH_ERROR_COPY[reason]}
          </p>
        </div>

        <Link
          href={signInPathWithNext(firstParam(params.next))}
          className={`${BTN_PRIMARY} mt-7`}
        >
          Voltar para entrar
        </Link>
      </section>
    </main>
  );
}
