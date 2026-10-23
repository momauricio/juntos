import type { Metadata } from "next";
import Link from "next/link";

import { signInPathWithNext } from "@/lib/auth-callback";

export const metadata: Metadata = {
  title: "Boas-vindas",
};

// Vitrine pública (PR9). Até lá, a demo estática atual.
const DEMO_URL =
  process.env.NEXT_PUBLIC_DEMO_URL || "https://momauricio.github.io/juntos/";

type WelcomePageProps = {
  searchParams: Promise<{
    next?: string | string[];
    code?: string | string[];
  }>;
};

function firstParam(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

function PhotoCard({
  emoji,
  gradient,
  className,
  children,
}: {
  emoji: string;
  gradient: string;
  className: string;
  children?: React.ReactNode;
}) {
  return (
    <div
      className={`absolute flex aspect-[3/4] w-[44%] flex-col rounded-[22px] bg-cream p-1.5 shadow-2xl shadow-black/40 ${className}`}
    >
      <div
        className={`relative flex flex-1 items-center justify-center rounded-[18px] ${gradient}`}
      >
        <span className="text-6xl drop-shadow-md">{emoji}</span>
        {children}
      </div>
    </div>
  );
}

export default async function WelcomePage({ searchParams }: WelcomePageProps) {
  const params = await searchParams;
  const startHref = signInPathWithNext(
    firstParam(params.next),
    firstParam(params.code),
  );

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-md flex-col px-6 pb-10 pt-12 text-foreground">
      <div
        aria-hidden="true"
        className="relative mx-auto aspect-[5/4] w-full max-w-sm"
      >
        <PhotoCard
          emoji="🏖️"
          gradient="bg-gradient-to-br from-[#e9dca8] via-[#5f9bb0] to-[#3f6f86]"
          className="left-[2%] top-[10%] -rotate-6"
        />
        <PhotoCard
          emoji="🍝"
          gradient="bg-gradient-to-br from-[#e0a35f] via-[#c47f4c] to-[#8e4a2b]"
          className="right-[2%] top-0 rotate-6"
        />
        <PhotoCard
          emoji="☕"
          gradient="bg-gradient-to-br from-[#f0c3a4] via-[#b8573c] to-[#7a3424]"
          className="left-1/2 top-[30%] -translate-x-1/2"
        >
          <span className="absolute bottom-3 left-3 rounded-full bg-cream px-3 py-1 text-sm font-semibold text-[#1a2238]">
            Quero ir 💛
          </span>
        </PhotoCard>
      </div>

      <section className="mt-12 space-y-4">
        <p className="text-sm font-semibold uppercase tracking-[0.3em] text-accent">
          Juntos
        </p>
        <h1 className="font-serif text-4xl font-semibold leading-tight tracking-tight sm:text-5xl">
          Os lugares que vocês querem viver, num lugar só
        </h1>
        <p className="text-lg leading-8 text-foreground/70">
          Salvem do Instagram em segundos, decidam juntos e guardem o que cada
          um achou.
        </p>
      </section>

      <div className="mt-auto space-y-5 pt-10">
        <Link
          href={startHref}
          className="flex h-14 w-full items-center justify-center rounded-3xl bg-accent px-4 text-lg font-semibold text-accent-contrast shadow-lg shadow-accent/30 transition hover:brightness-110"
        >
          Começar
        </Link>
        <a
          href={DEMO_URL}
          className="mx-auto block w-fit border-b border-foreground/60 pb-0.5 text-base font-semibold text-foreground"
        >
          Só quero dar uma olhada
        </a>
      </div>
    </main>
  );
}
