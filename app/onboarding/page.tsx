import { redirect } from "next/navigation";

import { InvitePanel } from "@/components/invite-panel";
import { createClient } from "@/lib/supabase/server";

type OnboardingPageProps = {
  searchParams: Promise<{
    code?: string | string[];
  }>;
};

export default async function OnboardingPage({
  searchParams,
}: OnboardingPageProps) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data: membership } = await supabase
    .from("space_members")
    .select("space_id")
    .eq("user_id", user.id)
    .maybeSingle();

  if (membership) {
    redirect("/");
  }

  const params = await searchParams;
  const code = Array.isArray(params.code) ? params.code[0] : params.code;

  return (
    <main className="min-h-dvh px-4 py-10 text-foreground">
      <div className="mx-auto w-full max-w-4xl">
        <section className="mb-8 text-center">
          <p className="text-sm font-semibold uppercase tracking-[0.18em] text-accent">
            Juntos
          </p>
          <h1 className="mt-3 font-serif text-4xl font-semibold tracking-tight sm:text-5xl">
            Monte a lista de vocês
          </h1>
          <p className="mx-auto mt-4 max-w-2xl text-base leading-7 text-foreground/70">
            Crie um espaço para compartilhar com seu par ou entre usando o
            convite que você recebeu.
          </p>
        </section>

        <InvitePanel initialCode={code} />
      </div>
    </main>
  );
}
