import Link from "next/link";
import { redirect } from "next/navigation";

import { LeaveSpace, SpaceNameForm } from "@/components/space-settings";
import { signInPathWithNext } from "@/lib/auth-callback";
import { spaceDisplayName } from "@/lib/invites";
import { loadMySpace } from "@/lib/space";
import { createClient } from "@/lib/supabase/server";

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
    <main className="px-4 pb-24 pt-8 sm:pb-12">
      <section className="mx-auto w-full max-w-4xl space-y-6">
        <div className="space-y-3">
          <p className="text-sm font-semibold uppercase tracking-[0.18em] text-accent">
            Ajustes
          </p>
          <h1 className="font-serif text-4xl font-semibold tracking-tight text-foreground sm:text-5xl">
            Seu espaço
          </h1>
          <p className="text-base leading-7 text-foreground/70">
            Dê um nome para o espaço, veja quem está nele e saia da sua conta
            quando precisar.
          </p>
        </div>

        <div className="grid gap-5 lg:grid-cols-[1fr_280px]">
          <section className="rounded-3xl bg-surface p-6 ring-1 ring-border">
            <h2 className="mb-4 font-serif text-2xl font-semibold tracking-tight">
              {spaceDisplayName(space.name, memberNames)}
            </h2>
            <SpaceNameForm name={space.name} computedName={computedName} />

            <div className="mt-6">
              <div className="flex items-center justify-between gap-4">
                <h3 className="text-base font-semibold text-foreground">
                  Pessoas
                </h3>
                <p className="rounded-2xl bg-surface-muted px-3 py-1 text-sm font-medium text-foreground/70">
                  {memberCount} de 2
                </p>
              </div>

              <ul className="mt-4 space-y-3">
                {space.members.map((member) => (
                  <li
                    key={member.userId}
                    className="flex items-center justify-between gap-3 rounded-2xl bg-surface-muted px-4 py-3 ring-1 ring-border"
                  >
                    <div>
                      <p className="font-medium text-foreground">
                        {member.displayName}
                      </p>
                      {member.userId === user.id ? (
                        <p className="text-sm text-foreground/65">Você</p>
                      ) : null}
                    </div>
                    <span className="rounded-xl bg-surface px-3 py-1 text-xs font-semibold uppercase tracking-[0.12em] text-foreground/60 ring-1 ring-border">
                      {ROLE_LABELS[member.role] ?? "Membro"}
                    </span>
                  </li>
                ))}
              </ul>

              {memberCount < 2 ? (
                <Link
                  href="/onboarding/convite"
                  className="mt-4 flex h-12 w-full items-center justify-center rounded-2xl bg-accent-strong px-4 text-base font-semibold text-accent-contrast transition hover:bg-accent"
                >
                  Chamar meu par
                </Link>
              ) : null}
            </div>

            <div className="mt-6">
              <LeaveSpace partnerName={partnerName} itemCount={itemCount} />
            </div>
          </section>

          <section className="rounded-3xl bg-surface p-6 ring-1 ring-border">
            <div className="space-y-3">
              <p className="text-sm font-semibold uppercase tracking-[0.18em] text-accent">
                Conta
              </p>
              <h2 className="font-serif text-2xl font-semibold tracking-tight">
                Sair
              </h2>
              <p className="text-sm leading-6 text-foreground/70">
                Encerre sua sessão neste dispositivo.
              </p>
            </div>

            <form action={logout}>
              <button
                type="submit"
                className="mt-6 h-12 w-full rounded-2xl bg-foreground px-4 text-base font-semibold text-surface transition hover:bg-accent-strong"
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
