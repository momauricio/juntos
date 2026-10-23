import type { Metadata } from "next";

import { EntrarForm } from "@/components/entrar-form";
import { safeRedirectPath } from "@/lib/auth-redirect";

export const metadata: Metadata = {
  title: "Entrar · Juntos",
};

type EntrarPageProps = {
  searchParams: Promise<{
    next?: string | string[];
    code?: string | string[];
  }>;
};

function firstParam(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

export default async function EntrarPage({ searchParams }: EntrarPageProps) {
  const params = await searchParams;

  return (
    <EntrarForm
      next={safeRedirectPath(firstParam(params.next), "")}
      code={firstParam(params.code)?.trim() ?? ""}
    />
  );
}
