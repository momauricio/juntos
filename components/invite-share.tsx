"use client";

import Link from "next/link";

import { useOnline } from "@/components/auth-hooks";
import { OfflineBanner } from "@/components/auth-ui";
import { Toast, useToast } from "@/components/toast";
import { INVITE_UNKNOWN_ERROR, whatsappUrl } from "@/lib/invites";

export const LINK_COPIED = "Link copiado. Agora é só colar pro seu par 💛";

function isTouchDevice() {
  return (
    navigator.maxTouchPoints > 0 ||
    window.matchMedia("(pointer: coarse)").matches
  );
}

function useCopyLink(link: string) {
  const [toast, showToast] = useToast();

  async function copy() {
    try {
      await navigator.clipboard.writeText(link);
      showToast(LINK_COPIED);
    } catch {
      showToast(INVITE_UNKNOWN_ERROR);
    }
  }

  return [toast, copy] as const;
}

const SECONDARY_BUTTON =
  "flex h-14 w-full items-center justify-center gap-2 rounded-3xl border border-foreground/30 px-4 text-lg font-semibold transition hover:bg-foreground/5 disabled:opacity-60";

export function CopyLinkButton({ link }: { link: string }) {
  const online = useOnline();
  const [toast, copy] = useCopyLink(link);

  return (
    <>
      {!online ? <OfflineBanner /> : null}
      <button
        type="button"
        onClick={copy}
        disabled={!online}
        className={SECONDARY_BUTTON}
      >
        Copiar link
      </button>
      {toast ? <Toast title={toast} /> : null}
    </>
  );
}

type InviteShareProps = {
  message: string;
  link: string;
  code: string;
};

// Tela 5: WhatsApp (ou a folha nativa no celular), copiar link e código.
export function InviteShare({ message, link, code }: InviteShareProps) {
  const online = useOnline();
  const [toast, copy] = useCopyLink(link);

  async function handleWhatsapp() {
    if (typeof navigator.share === "function" && isTouchDevice()) {
      try {
        await navigator.share({ text: message });
      } catch {
        // A pessoa fechou a folha de compartilhamento.
      }
      return;
    }

    window.open(whatsappUrl(message), "_blank", "noopener,noreferrer");
  }

  return (
    <>
      <div className="mt-8 rounded-[28px] bg-[#0d141d] p-5">
        <p className="text-center text-sm text-foreground/60">
          Prévia da mensagem
        </p>
        <p className="ml-auto mt-3 w-[92%] whitespace-pre-line break-words rounded-2xl bg-[#005c4b] px-4 py-3 text-lg leading-7">
          {message.replace(link, "")}
          <span className="text-[#53bdeb] underline">{link}</span>
        </p>
      </div>

      {!online ? (
        <div className="mt-6">
          <OfflineBanner />
        </div>
      ) : null}

      <button
        type="button"
        onClick={handleWhatsapp}
        disabled={!online}
        className="mt-6 flex h-14 w-full items-center justify-center gap-3 rounded-3xl bg-accent px-4 text-lg font-semibold text-accent-contrast shadow-lg shadow-accent/30 transition hover:brightness-110 disabled:opacity-60"
      >
        <span aria-hidden="true">💬</span>
        Chamar pelo WhatsApp
      </button>

      <button
        type="button"
        onClick={copy}
        disabled={!online}
        className={`mt-3 ${SECONDARY_BUTTON}`}
      >
        <span aria-hidden="true">🔗</span>
        Copiar link
      </button>

      <p className="mt-5 text-center text-foreground/60">
        Código do convite:{" "}
        <strong className="tracking-[0.15em] text-foreground/80">{code}</strong>{" "}
        · vale 7 dias
      </p>

      <Link
        href="/"
        className="mx-auto mt-4 text-lg underline underline-offset-4 transition hover:text-foreground/80"
      >
        Faço isso depois
      </Link>

      {toast ? <Toast title={toast} /> : null}
    </>
  );
}
