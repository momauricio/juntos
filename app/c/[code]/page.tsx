import type { Metadata } from "next";
import Link from "next/link";

import { Avatar, initial } from "@/components/avatar";
import {
  InviteJoinActions,
  InviteSignInActions,
  InviteSwitchActions,
} from "@/components/invite-actions";
import { CopyLinkButton } from "@/components/invite-share";
import { inviteFlowState } from "@/lib/invite-flow";
import {
  HOST_FALLBACK,
  INVITE_UNKNOWN_ERROR,
  type InvitePreview,
  inviteLink,
  inviteStatusAction,
  inviteStatusMessage,
  normalizeInviteCode,
} from "@/lib/invites";
import { TYPE_EMOJI } from "@/lib/labels";
import { getRequestOrigin } from "@/lib/request-origin";
import { loadMySpace } from "@/lib/space";
import { createClient } from "@/lib/supabase/server";
import type { ItemType } from "@/lib/types";

export const metadata: Metadata = {
  title: "Convite",
};

const PRIMARY_LINK =
  "mt-8 flex h-14 w-full items-center justify-center rounded-3xl bg-accent px-4 text-lg font-semibold text-accent-contrast shadow-lg shadow-accent/30 transition hover:brightness-110";

type InvitePageProps = {
  params: Promise<{ code: string }>;
};

const THUMBNAIL_GRADIENTS = [
  "bg-gradient-to-br from-[#f0c3a4] via-[#b8573c] to-[#7a3424]",
  "bg-gradient-to-br from-[#e9dca8] via-[#5f9bb0] to-[#3f6f86]",
  "bg-gradient-to-br from-[#e0a35f] via-[#c47f4c] to-[#8e4a2b]",
];

const BENEFITS = [
  ["📸", "Salvem do Instagram em segundos"],
  ["⚡", "O que um adiciona, o outro vê na hora"],
  ["⭐", "Cada um dá a sua nota — e sai a média do casal"],
];

function Frame({ children }: { children: React.ReactNode }) {
  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-md flex-col px-6 pb-10 pt-12 text-foreground">
      <p className="text-sm font-semibold uppercase tracking-[0.3em] text-accent">
        Juntos · Convite
      </p>
      {children}
    </main>
  );
}

function InviteHeader({ host }: { host: string }) {
  return (
    <>
      <div aria-hidden="true" className="mt-6 flex items-center gap-4">
        <Avatar label={initial(host)} size="lg" />
        <span className="text-5xl">💛</span>
        <Avatar label="você" size="lg" dashed className="text-lg" />
      </div>
      <h1 className="mt-6 font-serif text-4xl font-semibold leading-tight tracking-tight sm:text-5xl">
        {host} te chamou pro espaço de vocês
      </h1>
    </>
  );
}

function InvitePreviewBlock({ preview }: { preview: InvitePreview }) {
  if (preview.item_count === 0) {
    return (
      <p className="mt-4 text-lg leading-8 text-foreground/70">
        Ainda está tudo em branco — bora começar juntos?
      </p>
    );
  }

  return (
    <>
      <p className="mt-4 text-lg leading-8 text-foreground/70">
        Já tem lugar esperando vocês dois:
      </p>
      <div className="mt-4 grid grid-cols-3 gap-3 rounded-[28px] bg-surface p-3">
        {preview.thumbnails.slice(0, 3).map((type, index) => (
          <div
            key={index}
            className={`flex aspect-[5/4] items-center justify-center rounded-2xl ${THUMBNAIL_GRADIENTS[index]}`}
          >
            <span aria-hidden="true" className="text-4xl drop-shadow-md">
              {TYPE_EMOJI[type as ItemType] ?? "📍"}
            </span>
          </div>
        ))}
      </div>
      <p className="mt-3 text-lg text-foreground/70">
        {preview.item_count === 1
          ? "1 lugar"
          : `${preview.item_count} lugares`}{" "}
        em <strong className="text-foreground">Quero ir</strong>
      </p>
    </>
  );
}

function Message({ children }: { children: React.ReactNode }) {
  return (
    <p className="mt-6 font-serif text-3xl font-semibold leading-tight tracking-tight">
      {children}
    </p>
  );
}

export default async function InvitePage({ params }: InvitePageProps) {
  const { code: rawCode } = await params;
  const code = normalizeInviteCode(rawCode);
  const supabase = await createClient();
  const [{ data: previewData, error: previewError }, { data: userData }] =
    await Promise.all([
      supabase.rpc("invite_preview", { p_code: code }),
      supabase.auth.getUser(),
    ]);

  if (previewError || !previewData) {
    return (
      <Frame>
        <Message>{INVITE_UNKNOWN_ERROR}</Message>
      </Frame>
    );
  }

  const preview = previewData as InvitePreview;
  const host = preview.host_first_name?.trim() || HOST_FALLBACK;
  const user = userData.user;
  const mySpace = user ? await loadMySpace(supabase, user.id) : null;
  let myItemCount = 0;

  if (mySpace && mySpace.members.length === 1) {
    const { count } = await supabase
      .from("items")
      .select("id", { count: "exact", head: true })
      .eq("space_id", mySpace.id);
    myItemCount = count ?? 0;
  }

  const partnerName =
    mySpace?.members.find((member) => member.userId !== user?.id)
      ?.displayName ?? null;
  const state = inviteFlowState({
    preview,
    loggedIn: Boolean(user),
    mySpace: mySpace
      ? {
          memberCount: mySpace.members.length,
          itemCount: myItemCount,
          partnerName,
        }
      : null,
  });

  if (state.startsWith("error:")) {
    const action = inviteStatusAction(preview.status);

    return (
      <Frame>
        <Message>
          {inviteStatusMessage(
            preview.status as Exclude<InvitePreview["status"], "valid">,
            preview.host_first_name,
          )}
        </Message>
        {action ? (
          <Link href={action.href} className={PRIMARY_LINK}>
            {action.label}
          </Link>
        ) : null}
      </Frame>
    );
  }

  if (state === "signed_out") {
    return (
      <Frame>
        <InviteHeader host={host} />
        <InvitePreviewBlock preview={preview} />
        <ul className="mt-8 space-y-4 text-lg">
          {BENEFITS.map(([icon, text]) => (
            <li key={text} className="flex items-center gap-4">
              <span aria-hidden="true" className="text-2xl">
                {icon}
              </span>
              {text}
            </li>
          ))}
        </ul>
        <InviteSignInActions code={code} />
        <p className="mt-6 text-center text-sm text-foreground/60">
          Você entra com a sua própria conta. Os dois mexem em tudo, do mesmo
          jeito.
        </p>
      </Frame>
    );
  }

  if (state === "own") {
    return (
      <Frame>
        <Message>Esse convite é seu 😉 Mande o link pro seu par.</Message>
        <div className="mt-8 space-y-4">
          <CopyLinkButton link={inviteLink(await getRequestOrigin(), code)} />
        </div>
      </Frame>
    );
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("onboarded_at")
    .eq("id", user!.id)
    .maybeSingle();
  const successPath = profile?.onboarded_at
    ? "/?bem-vindo=1"
    : "/onboarding/nome";

  if (state === "join") {
    return (
      <Frame>
        <InviteHeader host={host} />
        <InvitePreviewBlock preview={preview} />
        <p className="mt-8 text-lg text-foreground/80">
          Você está entrando como{" "}
          <strong className="text-foreground">{user!.email}</strong>.
        </p>
        <InviteJoinActions
          code={code}
          host={preview.host_first_name}
          successPath={successPath}
        />
      </Frame>
    );
  }

  if (state === "switch_alone") {
    return (
      <Frame>
        <h1 className="mt-6 font-serif text-4xl font-semibold leading-tight tracking-tight sm:text-5xl">
          Você já começou um espaço
        </h1>
        <p className="mt-4 text-lg leading-8 text-foreground/70">
          Quer trazer seus {myItemCount} lugares e entrar no espaço de {host}?
        </p>
        <InviteSwitchActions
          code={code}
          host={preview.host_first_name}
          successPath={successPath}
        />
      </Frame>
    );
  }

  return (
    <Frame>
      <Message>
        Você já está num espaço com {partnerName ?? "seu par"}. Para entrar neste, primeiro
        saia do atual em Ajustes.
      </Message>
      <Link href="/settings" className={PRIMARY_LINK}>
        Abrir Ajustes
      </Link>
    </Frame>
  );
}
