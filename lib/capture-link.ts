import { STATUS_LABELS } from "@/lib/labels";
import type { ItemStatus } from "@/lib/types";

export const NOT_A_LINK_COPY =
  "Hmm, isso não parece um link. No post, toque em ⋯ → Copiar link.";
export const EMPTY_CLIPBOARD_COPY =
  "Não achamos nenhum link copiado. Cola aqui embaixo:";
export const TRELLO_SOON_COPY =
  "Já já chega! Por enquanto, cola um link ou pula 💛";
export const PICK_TYPE_COPY = "Escolhe um tipo pra salvar.";
export const SAVED_DONE_RATING_PROMPT = `Salvo em ${STATUS_LABELS.done} 💛 Que nota você dá?`;

export type ParsedLink =
  | { ok: true; url: string }
  | { ok: false; error: "not_a_link" };

const HTTP_SCHEME = /^https?:\/\//i;
const BARE_DOMAIN = /^(?:[a-z0-9-]+\.)+[a-z]{2,}(?::\d+)?(?:[/?#]|$)/i;
const INSTAGRAM_HOSTS = new Set(["instagram.com", "instagr.am"]);
const INSTAGRAM_POST = /^\/(?:[\w.]+\/)?(p|reel|tv)\/([\w-]+)(?:\/|$)/;

const NOT_A_LINK: ParsedLink = { ok: false, error: "not_a_link" };

export function parseLink(text: string): ParsedLink {
  const value = text.trim();

  if (!value || /\s/.test(value)) {
    return NOT_A_LINK;
  }

  const candidate = HTTP_SCHEME.test(value)
    ? value
    : BARE_DOMAIN.test(value)
      ? `https://${value}`
      : null;

  if (!candidate) {
    return NOT_A_LINK;
  }

  try {
    const url = new URL(candidate);
    return url.hostname ? { ok: true, url: url.href } : NOT_A_LINK;
  } catch {
    return NOT_A_LINK;
  }
}

// Post do Instagram → canonical da P1; qualquer outro link → o mesmo, sem hash.
export function normalizeLink(url: string): string {
  const parsed = new URL(url);
  const host = parsed.hostname.toLowerCase().replace(/^www\./, "");
  const post = INSTAGRAM_HOSTS.has(host)
    ? INSTAGRAM_POST.exec(parsed.pathname)
    : null;

  if (post) {
    return `https://www.instagram.com/${post[1]}/${post[2]}/`;
  }

  parsed.hash = "";
  return parsed.href;
}

export function captureLink(text: string): string | null {
  const parsed = parseLink(text);
  return parsed.ok ? normalizeLink(parsed.url) : null;
}

export function parseSavedStatus(
  value: string | string[] | undefined,
): ItemStatus | null {
  const status = Array.isArray(value) ? value[0] : value;
  return status === "want" || status === "done" ? status : null;
}

export function savedToastCopy(status: ItemStatus): string {
  return `Salvo em ${status === "done" ? STATUS_LABELS.done : STATUS_LABELS.want} 💛`;
}

// "Já fizemos" vai pro detalhe (a nota abre ali); "Quero ir" volta pro quadro.
export function savedRedirectPath(status: ItemStatus, id: string): string {
  return status === "done" ? `/items/${id}?salvo=done` : `/?salvo=${status}`;
}
