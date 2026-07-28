import { headers } from "next/headers";
import { redirect } from "next/navigation";

import { InvitePanel } from "@/components/invite-panel";
import { createClient } from "@/lib/supabase/server";

type SpaceMemberRow = {
  user_id: string;
  role: string;
  joined_at: string;
};

type ProfileRow = {
  id: string;
  display_name: string;
};

type ActiveInviteRow = {
  code: string;
  expires_at: string;
};

const ROLE_LABELS: Record<string, string> = {
  owner: "Responsável",
  member: "Membro",
};

async function getRequestOrigin() {
  const headersList = await headers();
  const host = headersList.get("host");

  if (!host) {
    return "";
  }

  const forwardedProto = headersList.get("x-forwarded-proto");
  const protocol =
    forwardedProto?.split(",")[0]?.trim() ??
    (host.startsWith("localhost") || host.startsWith("127.0.0.1")
      ? "http"
      : "https");

  return `${protocol}://${host}`;
}

async function logout() {
  "use server";

  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}

export default async function SettingsPage() {
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

  if (!membership) {
    redirect("/onboarding");
  }

  const { data: space, error: spaceError } = await supabase
    .from("spaces")
    .select("id,name")
    .eq("id", membership.space_id)
    .maybeSingle();

  if (spaceError || !space) {
    throw new Error("Não foi possível carregar o espaço.");
  }

  const { data: memberRows, error: membersError } = await supabase
    .from("space_members")
    .select("user_id,role,joined_at")
    .eq("space_id", membership.space_id)
    .order("joined_at", { ascending: true });

  if (membersError) {
    throw new Error("Não foi possível carregar os membros.");
  }

  const members = (memberRows ?? []) as SpaceMemberRow[];
  const userIds = members.map((member) => member.user_id);
  let profiles: ProfileRow[] = [];

  if (userIds.length > 0) {
    const { data: profileRows, error: profilesError } = await supabase
      .from("profiles")
      .select("id,display_name")
      .in("id", userIds);

    if (profilesError) {
      throw new Error("Não foi possível carregar os perfis.");
    }

    profiles = (profileRows ?? []) as ProfileRow[];
  }

  const profilesById = new Map(
    profiles.map((profile) => [profile.id, profile.display_name]),
  );
  const memberCount = members.length;
  const displayMembers = members.map((member, index) => ({
    ...member,
    displayName:
      profilesById.get(member.user_id) ??
      (member.user_id === user.id ? "Você" : `Pessoa ${index + 1}`),
  }));

  const origin = await getRequestOrigin();
  let activeInvite: ActiveInviteRow | null = null;

  if (memberCount < 2) {
    const { data: inviteRow, error: inviteError } = await supabase
      .from("invites")
      .select("code,expires_at")
      .eq("space_id", membership.space_id)
      .is("redeemed_at", null)
      .gt("expires_at", new Date().toISOString())
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (inviteError) {
      throw new Error("Não foi possível carregar o convite.");
    }

    activeInvite = (inviteRow as ActiveInviteRow | null) ?? null;
  }

  return (
    <main className="px-4 pb-24 pt-8 sm:pb-12">
      <section className="mx-auto w-full max-w-4xl space-y-6">
        <div className="space-y-3">
          <p className="text-sm font-semibold uppercase tracking-[0.18em] text-accent">
            Configurações
          </p>
          <h1 className="font-serif text-4xl font-semibold tracking-tight text-foreground sm:text-5xl">
            Seu espaço
          </h1>
          <p className="text-base leading-7 text-foreground/70">
            Veja quem está no espaço, convide seu par e saia da sua conta quando
            precisar.
          </p>
        </div>

        <div className="grid gap-5 lg:grid-cols-[1fr_280px]">
          <section className="rounded-3xl bg-surface p-6 ring-1 ring-border">
            <div className="space-y-2">
              <p className="text-sm font-medium text-foreground/70">
                Nome do espaço
              </p>
              <h2 className="font-serif text-2xl font-semibold tracking-tight">
                {space.name}
              </h2>
            </div>

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
                {displayMembers.map((member) => (
                  <li
                    key={member.user_id}
                    className="flex items-center justify-between gap-3 rounded-2xl bg-surface-muted px-4 py-3 ring-1 ring-border"
                  >
                    <div>
                      <p className="font-medium text-foreground">
                        {member.displayName}
                      </p>
                      {member.user_id === user.id ? (
                        <p className="text-sm text-foreground/65">Você</p>
                      ) : null}
                    </div>
                    <span className="rounded-xl bg-surface px-3 py-1 text-xs font-semibold uppercase tracking-[0.12em] text-foreground/60 ring-1 ring-border">
                      {ROLE_LABELS[member.role] ?? "Membro"}
                    </span>
                  </li>
                ))}
                {memberCount < 2 ? (
                  <li className="rounded-2xl border border-dashed border-border px-4 py-3 text-sm text-foreground/60">
                    Aguardando seu par entrar com o convite.
                  </li>
                ) : null}
              </ul>
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

        {memberCount < 2 ? (
          <InvitePanel
            variant="settings"
            spaceId={membership.space_id}
            origin={origin}
            initialCode={activeInvite?.code}
            initialExpiresAt={activeInvite?.expires_at}
          />
        ) : (
          <section className="rounded-3xl bg-surface p-6 ring-1 ring-border">
            <p className="text-sm font-semibold uppercase tracking-[0.18em] text-accent">
              Convite
            </p>
            <p className="mt-3 text-lg font-semibold text-foreground">
              Vocês dois já estão no espaço.
            </p>
          </section>
        )}
      </section>
    </main>
  );
}
