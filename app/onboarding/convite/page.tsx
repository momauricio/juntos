import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { Avatar, initial } from "@/components/avatar";
import { InviteShare } from "@/components/invite-share";
import { SavedToast } from "@/components/saved-toast";
import { StepProgress } from "@/components/step-progress";
import { SCREEN, STEP_LABEL, SUBTITLE } from "@/components/ui-classes";
import { signInPathWithNext } from "@/lib/auth-callback";
import { parseSavedStatus } from "@/lib/capture-link";
import {
  formatInviteCode,
  generateInviteCode,
  inviteLink,
  inviteMessage,
} from "@/lib/invites";
import { getRequestOrigin } from "@/lib/request-origin";
import { loadMySpace } from "@/lib/space";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = {
  title: "Chamar seu par",
};

type ConvitePageProps = {
  searchParams: Promise<{
    passo?: string | string[];
    salvo?: string | string[];
  }>;
};

export default async function ConvitePage({ searchParams }: ConvitePageProps) {
  const params = await searchParams;
  const passo = Array.isArray(params.passo) ? params.passo[0] : params.passo;
  const saved = parseSavedStatus(params.salvo);
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect(signInPathWithNext("/onboarding/convite"));
  }

  const space = await loadMySpace(supabase, user.id);

  if (!space) {
    redirect("/onboarding/nome");
  }

  if (space.members.length >= 2) {
    redirect("/");
  }

  const { data: activeInvite, error: inviteError } = await supabase
    .from("invites")
    .select("code")
    .eq("space_id", space.id)
    .is("redeemed_at", null)
    .gt("expires_at", new Date().toISOString())
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (inviteError) {
    throw new Error("Não foi possível carregar o convite.");
  }

  let code = activeInvite?.code as string | undefined;

  if (!code) {
    const { data, error } = await supabase.rpc("regenerate_invite", {
      p_space_id: space.id,
      p_code: generateInviteCode(),
    });

    if (error || typeof data !== "string") {
      throw new Error("Não foi possível gerar o convite.");
    }

    code = data;
  }

  const myName =
    space.members.find((member) => member.userId === user.id)?.displayName ??
    "";
  const link = inviteLink(await getRequestOrigin(), code);

  return (
    <main className={SCREEN}>
      {passo === "3" ? (
        <>
          <p className={`${STEP_LABEL} pt-3`}>Passo 3 de 3</p>
          <StepProgress step={3} />
        </>
      ) : null}

      <div
        aria-hidden="true"
        className="mt-[26px] flex items-center justify-center gap-3.5"
      >
        <Avatar label={initial(myName)} size="xl" />
        <span className="w-10 border-t-2 border-dashed border-cream/45" />
        <span className="text-[30px]">💛</span>
        <span className="w-10 border-t-2 border-dashed border-cream/45" />
        <Avatar label="?" size="xl" dashed />
      </div>

      <section className="mt-[18px] text-center">
        <h1 className="text-[31px] font-medium leading-[1.12] text-cream">
          Agora chama seu par
        </h1>
        <p className={`${SUBTITLE} mt-2.5`}>
          Fica bem melhor a dois: vocês veem tudo na hora e cada um dá a sua
          nota.
        </p>
      </section>

      <InviteShare
        message={inviteMessage(myName, link)}
        link={link}
        code={formatInviteCode(code)}
      />

      {saved ? <SavedToast status={saved} /> : null}
    </main>
  );
}
