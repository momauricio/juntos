"use client";

import Link from "next/link";

import { useOnline } from "@/components/auth-hooks";
import { OfflineBanner } from "@/components/auth-ui";
import { Toast, useToast } from "@/components/toast";
import {
  BTN_OUTLINE_LG,
  BTN_PRIMARY,
  TEXT_LINK_QUIET,
} from "@/components/ui-classes";
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
        className={BTN_OUTLINE_LG}
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
      <div className="mt-5 rounded-[20px] bg-[#0b141a] p-3.5">
        <p className="mb-2 text-center text-[11px] text-[#8696a0]">
          Prévia da mensagem
        </p>
        <p className="ml-[34px] whitespace-pre-line break-words rounded-[12px_12px_2px_12px] bg-[#005c4b] px-3 py-2.5 text-[14.5px] leading-[1.4] text-[#e9edef]">
          {message.replace(link, "")}
          <span className="text-[#53bdeb] underline">{link}</span>
          <span aria-hidden="true" className="mt-0.5 block text-right text-[11px] text-[#8fb3aa]">
            ✓✓
          </span>
        </p>
      </div>

      {!online ? (
        <div className="mt-4">
          <OfflineBanner />
        </div>
      ) : null}

      <button
        type="button"
        onClick={handleWhatsapp}
        disabled={!online}
        className={`${BTN_PRIMARY} mt-[18px]`}
      >
        <span aria-hidden="true">💬</span>
        Chamar pelo WhatsApp
      </button>

      <button
        type="button"
        onClick={copy}
        disabled={!online}
        className={`${BTN_OUTLINE_LG} mt-2.5`}
      >
        <span aria-hidden="true">🔗</span>
        Copiar link
      </button>

      <p className="mt-3 text-center text-[13px] text-cream/55">
        Código do convite:{" "}
        <strong className="tracking-[0.12em] text-cream/85">{code}</strong>{" "}
        · vale 7 dias
      </p>

      <Link
        href="/"
        className={`${TEXT_LINK_QUIET} mt-2.5`}
      >
        Faço isso depois
      </Link>

      {toast ? <Toast title={toast} /> : null}
    </>
  );
}
