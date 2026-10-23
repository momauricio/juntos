import type { Metadata } from "next";

import { BackLink } from "@/components/auth-ui";
import { LinkPasteCard } from "@/components/link-paste-card";

export const metadata: Metadata = {
  title: "Colar link",
};

export default function ColarPage() {
  return (
    <main className="mx-auto flex w-full max-w-md flex-col px-6 pb-24 pt-6">
      <BackLink href="/" />
      <h1 className="mt-4 font-serif text-4xl font-semibold leading-tight tracking-tight">
        Colar link
      </h1>
      <LinkPasteCard reviewPath="/colar/revisar" />
    </main>
  );
}
