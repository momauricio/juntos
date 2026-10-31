import type { Metadata } from "next";
import { Suspense } from "react";

import { DemoApp } from "@/components/demo-app";

export const metadata: Metadata = {
  title: "Demo",
};

export default function DemoPage() {
  return (
    <Suspense
      fallback={
        <main className="mx-auto flex min-h-dvh w-full max-w-lg items-center justify-center px-4">
          <p className="text-sm text-accent-strong/70">Carregando Juntos…</p>
        </main>
      }
    >
      <DemoApp />
    </Suspense>
  );
}
