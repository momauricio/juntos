import { describe, expect, it } from "vitest";
import {
  INVITE_CODE_EXPIRED,
  INVITE_CODE_INVALID,
  INVITE_UNKNOWN_ERROR,
  formatInviteCode,
  generateInviteCode,
  inviteCodeStatusError,
  inviteErrorAction,
  inviteErrorMessage,
  inviteExpiresAt,
  inviteLink,
  inviteMessage,
  inviteStatusAction,
  inviteStatusMessage,
  isInviteExpired,
  normalizeInviteCode,
  spaceDisplayName,
  whatsappUrl,
} from "@/lib/invites";

describe("generateInviteCode", () => {
  it("returns 8 chars from safe alphabet", () => {
    const code = generateInviteCode();
    expect(code).toHaveLength(8);
    expect(code).toMatch(/^[A-HJ-NP-Z2-9]{8}$/);
  });

  it("produces varied codes", () => {
    const set = new Set(Array.from({ length: 20 }, () => generateInviteCode()));
    expect(set.size).toBeGreaterThan(10);
  });
});

describe("invite expiry", () => {
  it("expires in 7 days", () => {
    const from = new Date("2026-07-28T12:00:00.000Z");
    const exp = inviteExpiresAt(from);
    expect(exp.toISOString()).toBe("2026-08-04T12:00:00.000Z");
  });

  it("detects expired invites", () => {
    expect(isInviteExpired("2026-07-01T00:00:00.000Z", new Date("2026-07-28"))).toBe(
      true,
    );
    expect(isInviteExpired("2026-08-01T00:00:00.000Z", new Date("2026-07-28"))).toBe(
      false,
    );
  });
});

describe("invite code format", () => {
  it("normalizes case, hyphens and spaces", () => {
    expect(normalizeInviteCode(" abcd-2345 ")).toBe("ABCD2345");
    expect(normalizeInviteCode("ab cd 23 45")).toBe("ABCD2345");
  });

  it("formats as XXXX-XXXX", () => {
    expect(formatInviteCode("ABCD2345")).toBe("ABCD-2345");
    expect(formatInviteCode("abcd-2345")).toBe("ABCD-2345");
  });
});

describe("invite sharing", () => {
  it("builds the short link", () => {
    expect(inviteLink("https://juntos.example", "abcd-2345")).toBe(
      "https://juntos.example/c/ABCD2345",
    );
  });

  it("builds the message with the link on the last line", () => {
    expect(inviteMessage("Mauricio", "https://j.example/c/ABCD2345")).toBe(
      "Mauricio te chamou pro Juntos 💛\nBora guardar os lugares que a gente quer viver?\nhttps://j.example/c/ABCD2345",
    );
  });

  it("encodes the message for WhatsApp", () => {
    expect(whatsappUrl("Oi & tchau 💛\nhttps://j.example/c/X")).toBe(
      "https://wa.me/?text=Oi%20%26%20tchau%20%F0%9F%92%9B%0Ahttps%3A%2F%2Fj.example%2Fc%2FX",
    );
  });
});

describe("spaceDisplayName", () => {
  it("uses the name the couple picked", () => {
    expect(spaceDisplayName("  Nós  ", ["Ana", "Bia"])).toBe("Nós");
  });

  it("falls back to the member names", () => {
    expect(spaceDisplayName(null, ["Ana", "Bia"])).toBe("Ana & Bia");
    expect(spaceDisplayName("   ", ["Ana"])).toBe("Ana");
    expect(spaceDisplayName(undefined, [])).toBe("");
  });
});

describe("invite messages", () => {
  it.each([
    ["invalid_invite", "Não achamos esse convite. Confere se o link veio inteiro?"],
    ["invite_used", "Esse convite já foi usado. Peça pra Ana mandar um novo 💛"],
    [
      "invite_expired",
      "Esse convite passou da validade (7 dias). Peça pra Ana mandar um novo.",
    ],
    [
      "space_full",
      "Esse espaço já está completo, com duas pessoas. Confere com Ana se o convite está certo.",
    ],
    ["own_invite", "Esse convite é seu 😉 Mande o link pro seu par."],
    [
      "space_has_partner",
      "Você já está num espaço com seu par. Pra entrar neste, primeiro saia do atual em Ajustes.",
    ],
    [
      "already_in_space",
      "Você já está num espaço com seu par. Pra entrar neste, primeiro saia do atual em Ajustes.",
    ],
    ["forbidden", INVITE_UNKNOWN_ERROR],
  ])("maps %s", (code, text) => {
    expect(inviteErrorMessage({ message: code }, "Ana")).toBe(text);
  });

  it("uses a fallback when the host is unknown", () => {
    expect(inviteErrorMessage({ message: "invite_used" }, null)).toBe(
      "Esse convite já foi usado. Peça pra quem te chamou mandar um novo 💛",
    );
  });

  it("maps unknown errors to the generic text", () => {
    expect(inviteErrorMessage({ message: "boom" }, "Ana")).toBe(
      "Algo saiu do roteiro. Tenta de novo em instantes.",
    );
    expect(inviteErrorMessage(null)).toBe(INVITE_UNKNOWN_ERROR);
  });

  it("maps preview statuses", () => {
    expect(inviteStatusMessage("used", "Ana")).toBe(
      "Esse convite já foi usado. Peça pra Ana mandar um novo 💛",
    );
    expect(inviteStatusMessage("expired", "Ana")).toBe(
      "Esse convite passou da validade (7 dias). Peça pra Ana mandar um novo.",
    );
    expect(inviteStatusMessage("invalid", null)).toBe(
      "Não achamos esse convite. Confere se o link veio inteiro?",
    );
    expect(inviteStatusMessage("full", "Ana")).toBe(
      "Esse espaço já está completo, com duas pessoas. Confere com Ana se o convite está certo.",
    );
    expect(inviteStatusMessage("full", " ")).toBe(
      "Esse espaço já está completo, com duas pessoas. Confere com quem te chamou se o convite está certo.",
    );
  });
});

describe("inviteErrorAction", () => {
  it("offers the way back to the board when already in a space", () => {
    expect(inviteErrorAction({ message: "already_in_space" })).toEqual({
      label: "Ir pro meu espaço",
      href: "/",
    });
  });

  it("opens settings when the space already has a partner", () => {
    expect(inviteErrorAction({ message: "space_has_partner" })).toEqual({
      label: "Abrir Ajustes",
      href: "/settings",
    });
  });

  it("offers a new space when the invited space is full", () => {
    expect(inviteErrorAction({ message: "space_full" })).toEqual({
      label: "Criar meu próprio espaço",
      href: "/onboarding/nome",
    });
  });

  it("has no action for other errors", () => {
    expect(inviteErrorAction({ message: "invite_used" })).toBeNull();
    expect(inviteErrorAction({ message: "boom" })).toBeNull();
    expect(inviteErrorAction(null)).toBeNull();
  });
});

describe("inviteStatusAction", () => {
  it("offers a new space when the invited space is full", () => {
    expect(inviteStatusAction("full")).toEqual({
      label: "Criar meu próprio espaço",
      href: "/onboarding/nome",
    });
  });

  it.each(["valid", "used", "expired", "invalid"] as const)(
    "has no action for %s",
    (status) => {
      expect(inviteStatusAction(status)).toBeNull();
    },
  );
});

describe("inviteCodeStatusError", () => {
  it("keeps invalid and expired codes on the form", () => {
    expect(inviteCodeStatusError("invalid")).toBe(INVITE_CODE_INVALID);
    expect(INVITE_CODE_INVALID).toBe(
      "Esse código não confere. Dá uma olhada de novo?",
    );
    expect(inviteCodeStatusError("expired")).toBe(INVITE_CODE_EXPIRED);
    expect(INVITE_CODE_EXPIRED).toBe(
      "Esse convite expirou. Pede um novo pro seu par?",
    );
  });

  it.each(["valid", "used", "full"] as const)(
    "lets %s go to the invite screen",
    (status) => {
      expect(inviteCodeStatusError(status)).toBeNull();
    },
  );
});
