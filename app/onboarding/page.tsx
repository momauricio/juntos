import { redirect } from "next/navigation";

import { signInPathWithNext } from "@/lib/auth-callback";
import { normalizeInviteCode } from "@/lib/invites";
import { createClient } from "@/lib/supabase/server";

type OnboardingPageProps = {
  searchParams: Promise<{
    code?: string | string[];
  }>;
};

// Só roteia: convite → /c/[code]; sem espaço → tela "Seu nome"; senão, quadro.
export default async function OnboardingPage({
  searchParams,
}: OnboardingPageProps) {
  const params = await searchParams;
  const rawCode = Array.isArray(params.code) ? params.code[0] : params.code;
  const code = normalizeInviteCode(rawCode ?? "");

  if (code) {
    redirect(`/c/${encodeURIComponent(code)}`);
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect(signInPathWithNext("/onboarding"));
  }

  const { data: membership } = await supabase
    .from("space_members")
    .select("space_id")
    .eq("user_id", user.id)
    .maybeSingle();

  redirect(membership ? "/" : "/onboarding/nome");
}
