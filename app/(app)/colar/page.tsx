import type { Metadata } from "next";

import { BackLink } from "@/components/auth-ui";
import { LinkPasteCard } from "@/components/link-paste-card";
import { TITLE } from "@/components/ui-classes";

export const metadata: Metadata = {
  title: "Colar link",
};

export default function ColarPage() {
  return (
    <main className="mx-auto flex w-full max-w-md flex-col px-5 pb-24 pt-2">
      <BackLink href="/" />
      <h1 className={`${TITLE} mt-2.5`}>
        Colar link
      </h1>
      <LinkPasteCard reviewPath="/colar/revisar" />
    </main>
  );
}
