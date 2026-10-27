import type { Metadata } from "next";
import Link from "next/link";

import {
  BTN_PRIMARY,
  EYEBROW_ACCENT,
  SCREEN,
  SUBTITLE,
  TEXT_LINK,
} from "@/components/ui-classes";
import { signInPathWithNext } from "@/lib/auth-callback";

export const metadata: Metadata = {
  title: "Boas-vindas",
};

// Vitrine pública (PR9).
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

// Foto inclinada com moldura creme (mockup .photo .ph1–.ph4).
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
      className={`absolute flex items-center justify-center overflow-hidden rounded-[20px] border-[6px] border-cream ${gradient} ${className}`}
    >
      <span>{emoji}</span>
      {children}
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
    <main className={SCREEN}>
      <div
        aria-hidden="true"
        className="relative mx-auto mt-1.5 aspect-[350/330] w-full max-w-[350px]"
      >
        <PhotoCard
          emoji="🏖️"
          gradient="ph2"
          className="left-[8.6%] top-[12%] h-[57.6%] w-[42.9%] -rotate-8 text-[56px]"
        />
        <PhotoCard
          emoji="🍝"
          gradient="ph3"
          className="left-[54.3%] top-[6%] h-[57.6%] w-[42.9%] rotate-7 text-[56px]"
        />
        <PhotoCard
          emoji="☕"
          gradient="ph1"
          className="left-[31.4%] top-[36.4%] h-[60.6%] w-[45.7%] -rotate-1 text-[60px] shadow-[0_20px_40px_rgba(0,0,0,0.35)]"
        >
          <span className="absolute bottom-2.5 left-2.5 rounded-full bg-cream px-2 py-0.5 text-xs font-bold text-ink">
            Quero ir 💛
          </span>
        </PhotoCard>
      </div>

      <section className="mt-[22px]">
        <p className={EYEBROW_ACCENT}>Juntos</p>
        <h1 className="mt-2.5 text-[36px] font-medium leading-[1.12] text-cream">
          Os lugares que vocês querem viver, num lugar só
        </h1>
        <p className={`${SUBTITLE} mt-3.5`}>
          Salvem do Instagram em segundos, decidam juntos e guardem o que cada
          um achou.
        </p>
      </section>

      <div className="mt-auto flex flex-col gap-[18px] pb-2 pt-10">
        <Link href={startHref} className={BTN_PRIMARY}>
          Começar
        </Link>
        <a href={DEMO_URL} className={TEXT_LINK}>
          Só quero dar uma olhada
        </a>
      </div>
    </main>
  );
}
