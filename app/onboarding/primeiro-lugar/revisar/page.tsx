import type { Metadata } from "next";
import { redirect } from "next/navigation";

import {
  PlaceReviewCard,
  type PlaceReviewState,
} from "@/components/place-review-card";
import { captureLink } from "@/lib/capture-link";
import { requireSpace, savePlace } from "@/lib/save-place";

export const metadata: Metadata = {
  title: "Revisar lugar",
};

const PRIMEIRO_LUGAR_PATH = "/onboarding/primeiro-lugar";

async function save(
  _state: PlaceReviewState,
  formData: FormData,
): Promise<PlaceReviewState> {
  "use server";

  const result = await savePlace(formData, PRIMEIRO_LUGAR_PATH);

  if (!result.ok) {
    return { error: result.error };
  }

  // Mantém o passo 3; se salvou em "Já fizemos", a nota abre sozinha (PR3)
  // na primeira vez que a pessoa abrir o item.
  redirect(`/onboarding/convite?passo=3&salvo=${result.status}`);
}

type RevisarPageProps = {
  searchParams: Promise<{
    url?: string | string[];
  }>;
};

export default async function RevisarPage({ searchParams }: RevisarPageProps) {
  const params = await searchParams;
  const rawUrl = Array.isArray(params.url) ? params.url[0] : params.url;
  const url = captureLink(rawUrl ?? "");

  if (!url) {
    redirect(PRIMEIRO_LUGAR_PATH);
  }

  await requireSpace(PRIMEIRO_LUGAR_PATH);

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-md flex-col px-6 pb-10 pt-8 text-foreground">
      <PlaceReviewCard
        url={url}
        backHref={PRIMEIRO_LUGAR_PATH}
        saveAction={save}
      />
    </main>
  );
}
