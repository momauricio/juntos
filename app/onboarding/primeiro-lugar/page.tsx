import type { Metadata } from "next";
import Link from "next/link";

import { LinkPasteCard } from "@/components/link-paste-card";
import { StepProgress } from "@/components/step-progress";
import { TrelloSoonCard } from "@/components/trello-soon-card";
import { requireSpace } from "@/lib/save-place";

export const metadata: Metadata = {
  title: "Primeiro lugar",
};

export default async function PrimeiroLugarPage() {
  await requireSpace("/onboarding/primeiro-lugar");

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-md flex-col px-6 pb-10 pt-8 text-foreground">
      <p className="text-lg text-foreground/70">Passo 2 de 3</p>
      <StepProgress step={2} />

      <section className="mt-10 space-y-4">
        <h1 className="font-serif text-4xl font-semibold leading-tight tracking-tight sm:text-5xl">
          Bora começar com um lugar?
        </h1>
        {/* TODO(P1): voltar para "A gente preenche o resto." quando o extrator entrar. */}
        <p className="text-lg leading-8 text-foreground/70">
          Cola o link de um post que vocês salvaram. O link fica guardado no
          card. Você só completa o nome e o tipo.
        </p>
      </section>

      <LinkPasteCard reviewPath="/onboarding/primeiro-lugar/revisar" />

      <div
        aria-hidden="true"
        className="my-6 flex items-center gap-4 text-foreground/60"
      >
        <span className="flex-1 border-t border-foreground/20" />
        ou
        <span className="flex-1 border-t border-foreground/20" />
      </div>

      <TrelloSoonCard />

      <Link
        href="/onboarding/convite?passo=3"
        className="mx-auto mt-8 text-lg underline underline-offset-4 transition hover:text-foreground/80"
      >
        Pular por enquanto
      </Link>
    </main>
  );
}
