import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { NomeForm, type NomeFormState } from "@/components/nome-form";
import { signInPathWithNext } from "@/lib/auth-callback";
import {
  DISPLAY_NAME_SAVE_ERROR,
  googleFirstName,
  validateDisplayName,
} from "@/lib/display-name";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = {
  title: "Seu nome · Juntos",
};

const NOME_PATH = "/onboarding/nome";

async function requireUserId() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect(signInPathWithNext(NOME_PATH));
  }

  return { supabase, userId: user.id };
}

async function saveName(
  _state: NomeFormState,
  formData: FormData,
): Promise<NomeFormState> {
  "use server";

  const rawName = formData.get("display_name");
  const result = validateDisplayName(typeof rawName === "string" ? rawName : "");

  if (!result.ok) {
    return { error: result.error };
  }

  const { supabase, userId } = await requireUserId();
  const { error } = await supabase
    .from("profiles")
    .update({
      display_name: result.value,
      onboarded_at: new Date().toISOString(),
    })
    .eq("id", userId);

  if (error) {
    return { error: DISPLAY_NAME_SAVE_ERROR };
  }

  redirect("/onboarding");
}

// "Pular": mantém o nome sugerido pelo trigger (Google ou parte antes do @).
async function skip() {
  "use server";

  const { supabase, userId } = await requireUserId();
  await supabase
    .from("profiles")
    .update({ onboarded_at: new Date().toISOString() })
    .eq("id", userId);

  redirect("/onboarding");
}

export default async function NomePage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect(signInPathWithNext(NOME_PATH));
  }

  const { data: membership } = await supabase
    .from("space_members")
    .select("space_id")
    .eq("user_id", user.id)
    .maybeSingle();

  if (membership) {
    redirect("/");
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("onboarded_at")
    .eq("id", user.id)
    .maybeSingle();

  // A tela aparece uma vez só.
  if (profile?.onboarded_at) {
    redirect("/onboarding");
  }

  return (
    <NomeForm
      saveAction={saveName}
      skipAction={skip}
      googleName={googleFirstName(user)}
    />
  );
}
