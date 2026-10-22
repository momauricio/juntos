import type { Metadata } from "next";

import { BackLink } from "@/components/auth-ui";

export const metadata: Metadata = {
  title: "Privacidade · Juntos",
};

// Página provisória: o texto jurídico fica fora do escopo do PR2.
export default function PrivacidadePage() {
  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-md flex-col px-6 pb-10 pt-8 text-foreground">
      <BackLink href="/entrar" />
      <h1 className="mt-8 font-serif text-4xl font-semibold tracking-tight">
        Privacidade
      </h1>
      <p className="mt-4 text-lg leading-8 text-foreground/70">
        Estamos preparando este texto. Em breve ele aparece aqui.
      </p>
    </main>
  );
}
