import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { CodigoForm } from "@/components/codigo-form";
import { signInPathWithNext } from "@/lib/auth-callback";
import { safeRedirectPath } from "@/lib/auth-redirect";
import { isValidEmail, normalizeEmail } from "@/lib/otp";

export const metadata: Metadata = {
  title: "Confere seu e-mail",
};

type CodigoPageProps = {
  searchParams: Promise<{
    email?: string | string[];
    next?: string | string[];
    code?: string | string[];
  }>;
};

function firstParam(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

export default async function CodigoPage({ searchParams }: CodigoPageProps) {
  const params = await searchParams;
  const email = firstParam(params.email) ?? "";
  const next = safeRedirectPath(firstParam(params.next), "");
  const code = firstParam(params.code)?.trim() ?? "";

  if (!isValidEmail(email)) {
    redirect(signInPathWithNext(next, code));
  }

  return <CodigoForm email={normalizeEmail(email)} next={next} code={code} />;
}
