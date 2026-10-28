import type { Metadata } from "next";
import Link from "next/link";

import { Avatar, initial } from "@/components/avatar";
import {
  InviteJoinActions,
  InviteSignInActions,
  InviteSwitchActions,
} from "@/components/invite-actions";
import { CopyLinkButton } from "@/components/invite-share";
import { typeGradient } from "@/components/item-visuals";
import {
  BTN_PRIMARY,
  CARD,
  EYEBROW_ACCENT,
  SCREEN,
  SUBTITLE,
  TITLE,
} from "@/components/ui-classes";
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
import { STATUS_LABELS, typeEmoji } from "@/lib/labels";
import { getRequestOrigin } from "@/lib/request-origin";
import { loadMySpace } from "@/lib/space";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = {
  title: "Convite",
};

const PRIMARY_LINK = `${BTN_PRIMARY} mt-8`;

type InvitePageProps = {
  params: Promise<{ code: string }>;
};

const BENEFITS = [
  ["📸", "Salvem do Instagram em segundos"],
  ["⚡", "O que um adiciona, o outro vê na hora"],
  ["⭐", "Cada um dá a sua nota — e sai a média do casal"],
];

function Frame({ children }: { children: React.ReactNode }) {
  return (
    <main className={SCREEN}>
      <p className={EYEBROW_ACCENT}>Juntos · Convite</p>
      {children}
    </main>
  );
}

function InviteHeader({ host }: { host: string }) {
  return (
    <>
      <div aria-hidden="true" className="mt-[18px] flex items-center gap-3">
        <Avatar label={initial(host)} size="lg" />
        <span className="text-[26px]">💛</span>
        <span className="flex h-14 w-14 items-center justify-center rounded-full border-2 border-dashed border-cream/50 text-sm font-bold text-cream/70">
          você
        </span>
      </div>
      <h1 className="mt-[18px] text-[32px] font-medium leading-[1.12] text-cream">
        {host} te chamou pro espaço de vocês
      </h1>
    </>
  );
}

function InvitePreviewBlock({ preview }: { preview: InvitePreview }) {
  if (preview.item_count === 0) {
    return (
      <p className={`${SUBTITLE} mt-3`}>
        Ainda está tudo em branco — bora começar juntos?
      </p>
    );
  }

  return (
    <>
      <p className={`${SUBTITLE} mt-3`}>Já tem lugar esperando vocês dois:</p>
      <div className={`${CARD} mt-3.5 grid grid-cols-3 gap-2 p-3`}>
        {preview.thumbnails.slice(0, 3).map((type, index) => (
          <div
            key={index}
            className={`flex h-[84px] items-center justify-center rounded-[14px] ${typeGradient(type)}`}
          >
            <span aria-hidden="true" className="text-[32px]">
              {typeEmoji(type)}
            </span>
          </div>
        ))}
      </div>
      <p className="mt-2 text-sm text-cream/70">
        {preview.item_count === 1
          ? "1 lugar"
          : `${preview.item_count} lugares`}{" "}
        em <strong className="text-cream">{STATUS_LABELS.want}</strong>
      </p>
    </>
  );
}

function Message({ children }: { children: React.ReactNode }) {
  return (
    <p className="mt-6 font-serif text-[28px] font-medium leading-[1.15] text-cream">
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
        <ul className="mt-[22px] space-y-2.5 text-[15px] text-cream/85">
          {BENEFITS.map(([icon, text]) => (
            <li key={text} className="flex items-center gap-2.5">
              <span aria-hidden="true">
                {icon}
              </span>
              {text}
            </li>
          ))}
        </ul>
        <InviteSignInActions code={code} />
        <p className="mt-4 text-center text-[12.5px] text-cream/55">
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
        <p className="mt-6 text-[15px] text-cream/80">
          Você está entrando como{" "}
          <strong className="[overflow-wrap:anywhere] text-cream">
            {user!.email}
          </strong>
          .
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
        <h1 className={`${TITLE} mt-6`}>Você já começou um espaço</h1>
        <p className={`${SUBTITLE} mt-3`}>
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
