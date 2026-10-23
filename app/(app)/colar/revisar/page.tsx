import type { Metadata } from "next";
import { redirect } from "next/navigation";

import {
  PlaceReviewCard,
  type PlaceReviewState,
} from "@/components/place-review-card";
import { captureLink, savedRedirectPath } from "@/lib/capture-link";
import { savePlace } from "@/lib/save-place";

export const metadata: Metadata = {
  title: "Revisar lugar",
};

const COLAR_PATH = "/colar";

async function save(
  _state: PlaceReviewState,
  formData: FormData,
): Promise<PlaceReviewState> {
  "use server";

  const result = await savePlace(formData, COLAR_PATH);

  if (!result.ok) {
    return { error: result.error };
  }

  redirect(savedRedirectPath(result.status, result.id));
}

type ColarRevisarPageProps = {
  searchParams: Promise<{
    url?: string | string[];
  }>;
};

export default async function ColarRevisarPage({
  searchParams,
}: ColarRevisarPageProps) {
  const params = await searchParams;
  const rawUrl = Array.isArray(params.url) ? params.url[0] : params.url;
  const url = captureLink(rawUrl ?? "");

  if (!url) {
    redirect(COLAR_PATH);
  }

  return (
    <main className="mx-auto flex w-full max-w-md flex-col px-6 pb-24 pt-6">
      <PlaceReviewCard url={url} backHref={COLAR_PATH} saveAction={save} />
    </main>
  );
}
