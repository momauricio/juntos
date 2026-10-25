import type { Metadata } from "next";

import { BackLink } from "@/components/auth-ui";
import { SCREEN, SUBTITLE, TITLE } from "@/components/ui-classes";

export const metadata: Metadata = {
  title: "Termos",
};

// Página provisória: o texto jurídico fica fora do escopo do PR2.
export default function TermosPage() {
  return (
    <main className={SCREEN}>
      <BackLink href="/entrar" />
      <h1 className={`${TITLE} mt-2.5`}>Termos de uso</h1>
      <p className={`${SUBTITLE} mt-3`}>
        Estamos preparando este texto. Em breve ele aparece aqui.
      </p>
    </main>
  );
}
