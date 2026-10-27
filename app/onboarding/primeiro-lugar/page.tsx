import type { Metadata } from "next";
import Link from "next/link";

import { LinkPasteCard } from "@/components/link-paste-card";
import { StepProgress } from "@/components/step-progress";
import {
  SCREEN,
  STEP_LABEL,
  SUBTITLE,
  TEXT_LINK,
  TITLE,
} from "@/components/ui-classes";
import { requireSpace } from "@/lib/save-place";

export const metadata: Metadata = {
  title: "Primeiro lugar",
};

export default async function PrimeiroLugarPage() {
  await requireSpace("/onboarding/primeiro-lugar");

  return (
    <main className={SCREEN}>
      <p className={`${STEP_LABEL} pt-3`}>Passo 2 de 3</p>
      <StepProgress step={2} />

      <section className="mt-[26px]">
        <h1 className={TITLE}>Bora começar com um lugar?</h1>
        {/* TODO(P1): voltar para "A gente preenche o resto." quando o extrator entrar. */}
        <p className={`${SUBTITLE} mt-3`}>
          Cola o link de um post que vocês salvaram. O link fica guardado no
          card. Você só completa o nome e o tipo.
        </p>
      </section>

      <LinkPasteCard reviewPath="/onboarding/primeiro-lugar/revisar" />

      <Link
        href="/onboarding/convite?passo=3"
        className={`${TEXT_LINK} mt-[22px]`}
      >
        Pular por enquanto
      </Link>
    </main>
  );
}
