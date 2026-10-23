import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { NomeForm, type NomeFormState } from "@/components/nome-form";
import { signInPathWithNext } from "@/lib/auth-callback";
import {
  DISPLAY_NAME_SAVE_ERROR,
  googleFirstName,
  normalizeSpaceName,
  validateDisplayName,
} from "@/lib/display-name";
import { generateInviteCode, inviteErrorMessage } from "@/lib/invites";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = {
  title: "Seu nome · Juntos",
};

const NOME_PATH = "/onboarding/nome";
const CONVITE_PATH = "/onboarding/convite?passo=3";
const WELCOME_PATH = "/?bem-vindo=1";

async function requireUser() {
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

  return { supabase, user, isMember: Boolean(membership) };
}

type Session = Awaited<ReturnType<typeof requireUser>>;

// Sem espaço: cria o espaço (com o nome do casal, se veio) e segue para o
// convite. Se já entrou em um espaço nesse meio-tempo, vai para o quadro.
async function createSpace(
  supabase: Session["supabase"],
  spaceName: string | null,
): Promise<NomeFormState> {
  const { error } = await supabase.rpc("create_space_with_invite", {
    p_name: spaceName,
    p_code: generateInviteCode(),
  });

  if (error?.message.includes("already_in_space")) {
    redirect("/");
  }

  if (error) {
    return { error: inviteErrorMessage(error) };
  }

  redirect(CONVITE_PATH);
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

  const { supabase, user, isMember } = await requireUser();
  const { error } = await supabase
    .from("profiles")
    .update({
      display_name: result.value,
      onboarded_at: new Date().toISOString(),
    })
    .eq("id", user.id);

  if (error) {
    return { error: DISPLAY_NAME_SAVE_ERROR };
  }

  if (isMember) {
    redirect(WELCOME_PATH);
  }

  const rawSpaceName = formData.get("space_name");

  return createSpace(
    supabase,
    normalizeSpaceName(typeof rawSpaceName === "string" ? rawSpaceName : null),
  );
}

// "Pular": mantém o nome sugerido pelo trigger (Google ou parte antes do @).
async function skip() {
  "use server";

  const { supabase, user, isMember } = await requireUser();
  await supabase
    .from("profiles")
    .update({ onboarded_at: new Date().toISOString() })
    .eq("id", user.id);

  if (isMember) {
    redirect(WELCOME_PATH);
  }

  const { error } = await createSpace(supabase, null);

  if (error) {
    throw new Error(error);
  }
}

export default async function NomePage() {
  const { supabase, user, isMember } = await requireUser();
  const { data: profile } = await supabase
    .from("profiles")
    .select("display_name,onboarded_at")
    .eq("id", user.id)
    .maybeSingle();

  // Quem já tem espaço vê a tela uma vez só (convidado: só o nome).
  if (isMember && profile?.onboarded_at) {
    redirect("/");
  }

  const googleName = googleFirstName(user);
  // Sem espaço e já onboarded (ex.: saiu do espaço): começa com o nome atual.
  const initialName =
    !isMember && profile?.onboarded_at
      ? (profile.display_name ?? googleName)
      : googleName;

  return (
    <NomeForm
      saveAction={saveName}
      skipAction={skip}
      variant={isMember ? "guest" : "creator"}
      initialName={initialName}
      googleName={googleName}
    />
  );
}
