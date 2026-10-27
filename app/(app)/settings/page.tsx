import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";

import { Avatar, initial, memberTone } from "@/components/avatar";
import { LeaveSpace, SpaceNameForm } from "@/components/space-settings";
import {
  BTN_PRIMARY,
  CARD,
  EYEBROW_ACCENT,
  SUBTITLE,
  TITLE,
} from "@/components/ui-classes";
import { signInPathWithNext } from "@/lib/auth-callback";
import { spaceDisplayName } from "@/lib/invites";
import { loadMySpace } from "@/lib/space";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = {
  title: "Ajustes",
};

const ROLE_LABELS: Record<string, string> = {
  owner: "Responsável",
  member: "Membro",
};

async function logout() {
  "use server";

  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect(signInPathWithNext(null));
}

export default async function SettingsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect(signInPathWithNext("/settings"));
  }

  const space = await loadMySpace(supabase, user.id);

  if (!space) {
    redirect("/onboarding");
  }

  const memberCount = space.members.length;
  const memberNames = space.members.map((member) => member.displayName);
  const computedName = spaceDisplayName(null, memberNames);
  const partnerName =
    space.members.find((member) => member.userId !== user.id)?.displayName ??
    null;
  let itemCount = 0;

  if (!partnerName) {
    const { count, error: countError } = await supabase
      .from("items")
      .select("id", { count: "exact", head: true })
      .eq("space_id", space.id);

    if (countError) {
      throw new Error("Não foi possível carregar os lugares.");
    }

    itemCount = count ?? 0;
  }

  return (
    <main className="px-5 pb-24 pt-2 sm:pb-12">
      <section className="mx-auto w-full max-w-lg space-y-6">
        <div className="space-y-2.5">
          <p className={EYEBROW_ACCENT}>Ajustes</p>
          <h1 className={TITLE}>Seu espaço</h1>
          <p className={SUBTITLE}>
            Dê um nome para o espaço, veja quem está nele e saia da sua conta
            quando precisar.
          </p>
        </div>

        <div className="grid gap-4">
          <section className={CARD}>
            <h2 className="mb-4 text-2xl font-medium leading-tight">
              {spaceDisplayName(space.name, memberNames)}
            </h2>
            <SpaceNameForm name={space.name} computedName={computedName} />

            <div className="mt-6">
              <div className="flex items-center justify-between gap-4">
                <h3 className="text-base font-semibold">Pessoas</h3>
                <p className="rounded-full bg-ink/[0.07] px-3 py-1 text-sm font-semibold text-ink/70">
                  {memberCount} de 2
                </p>
              </div>

              <ul className="mt-4 space-y-3">
                {space.members.map((member, index) => (
                  <li
                    key={member.userId}
                    className="flex items-center justify-between gap-3 rounded-2xl bg-ink/[0.05] px-3.5 py-3"
                  >
                    <div className="flex min-w-0 items-center gap-3">
                      <Avatar
                        label={initial(member.displayName)}
                        size="md"
                        tone={memberTone(index)}
                      />
                      <div className="min-w-0">
                        <p className="truncate font-semibold">
                          {member.displayName}
                        </p>
                        {member.userId === user.id ? (
                          <p className="text-sm text-ink/65">Você</p>
                        ) : null}
                      </div>
                    </div>
                    <span className="shrink-0 rounded-full bg-ink/[0.07] px-2.5 py-1 text-xs font-bold uppercase tracking-[0.08em] text-ink/65">
                      {ROLE_LABELS[member.role] ?? "Membro"}
                    </span>
                  </li>
                ))}
              </ul>

              {memberCount < 2 ? (
                <Link
                  href="/onboarding/convite"
                  className={`${BTN_PRIMARY} mt-4`}
                >
                  Chamar meu par
                </Link>
              ) : null}
            </div>

            <div className="mt-6">
              <LeaveSpace partnerName={partnerName} itemCount={itemCount} />
            </div>
          </section>

          <section className={CARD}>
            <div className="space-y-2">
              <p className={EYEBROW_ACCENT}>Conta</p>
              <h2 className="text-2xl font-medium leading-tight">Sair</h2>
              <p className="text-sm leading-6 text-ink/70">
                Encerre sua sessão neste dispositivo.
              </p>
            </div>

            <form action={logout}>
              <button
                type="submit"
                className="mt-5 flex h-[52px] w-full items-center justify-center rounded-2xl bg-ink px-5 text-base font-semibold text-cream transition hover:brightness-125"
              >
                Sair da conta
              </button>
            </form>
          </section>
        </div>
      </section>
    </main>
  );
}
