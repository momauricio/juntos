import { describe, expect, it } from "vitest";

import {
  DISPLAY_NAME_ERROR,
  DISPLAY_NAME_SAVE_ERROR,
  firstName,
  emailFallbackName,
  googleFirstName,
  initialDisplayName,
  validateDisplayName,
} from "@/lib/display-name";

describe("firstName", () => {
  it("keeps only the first name", () => {
    expect(firstName("  Maria   Clara Souza ")).toBe("Maria");
    expect(firstName("Mauricio")).toBe("Mauricio");
    expect(firstName("")).toBe("");
    expect(firstName(null)).toBe("");
  });

  it("limits to 40 characters", () => {
    expect(firstName("a".repeat(50))).toHaveLength(40);
  });
});

describe("googleFirstName", () => {
  it("uses full_name, then name, for Google users", () => {
    expect(
      googleFirstName({
        app_metadata: { provider: "google", providers: ["google"] },
        user_metadata: { full_name: "Ana Paula Lima", name: "Outra" },
      }),
    ).toBe("Ana");
    expect(
      googleFirstName({
        app_metadata: { provider: "email", providers: ["email", "google"] },
        user_metadata: { full_name: " ", name: "Bia Souza" },
      }),
    ).toBe("Bia");
  });

  it("is empty for e-mail code logins", () => {
    expect(
      googleFirstName({
        app_metadata: { provider: "email", providers: ["email"] },
        user_metadata: { full_name: "Ana Paula" },
      }),
    ).toBe("");
  });
});

describe("validateDisplayName", () => {
  it("accepts 1 to 40 characters, trimmed", () => {
    expect(validateDisplayName("  Ana ")).toEqual({ ok: true, value: "Ana" });
    expect(validateDisplayName("A")).toEqual({ ok: true, value: "A" });
    expect(validateDisplayName("a".repeat(40)).ok).toBe(true);
  });

  it("rejects empty, blank-only or too long names", () => {
    expect(validateDisplayName("")).toEqual({ ok: false, error: DISPLAY_NAME_ERROR });
    expect(validateDisplayName("    ").ok).toBe(false);
    expect(validateDisplayName("a".repeat(41)).ok).toBe(false);
  });
});

describe("display name copy", () => {
  it("uses the designer's microcopy", () => {
    expect(DISPLAY_NAME_ERROR).toBe("Escreve seu nome, com até 40 letras.");
    expect(DISPLAY_NAME_SAVE_ERROR).toBe(
      "Não deu pra salvar seu nome agora. Tenta de novo?",
    );
    expect(validateDisplayName("    ")).toEqual({
      ok: false,
      error: "Escreve seu nome, com até 40 letras.",
    });
  });
});

describe("emailFallbackName", () => {
  it("mirrors handle_new_user without a Google name", () => {
    expect(emailFallbackName("maria.clara@example.com")).toBe("maria.clara");
    expect(emailFallbackName(`${"a".repeat(50)}@example.com`)).toBe(
      "a".repeat(40),
    );
    expect(emailFallbackName("@example.com")).toBe("eu");
    expect(emailFallbackName(null)).toBe("eu");
  });
});

describe("initialDisplayName", () => {
  it("starts empty for a new account from the e-mail code", () => {
    expect(
      initialDisplayName({
        displayName: "maria.clara",
        email: "maria.clara@example.com",
        onboardedAt: null,
        googleName: "",
      }),
    ).toBe("");
  });

  it("ignores case when comparing with the e-mail fallback", () => {
    expect(
      initialDisplayName({
        displayName: "maria",
        email: "Maria@Example.com",
        onboardedAt: null,
        googleName: "",
      }),
    ).toBe("");
  });

  it("uses the Google name for a new Google account", () => {
    expect(
      initialDisplayName({
        displayName: "Maria",
        email: "maria.souza@gmail.com",
        onboardedAt: null,
        googleName: "Maria",
      }),
    ).toBe("Maria");
  });

  it("keeps the name chosen during onboarding", () => {
    expect(
      initialDisplayName({
        displayName: "maria",
        email: "maria@example.com",
        onboardedAt: "2026-10-01T12:00:00Z",
        googleName: "",
      }),
    ).toBe("maria");
    expect(
      initialDisplayName({
        displayName: "Mari",
        email: "maria.souza@gmail.com",
        onboardedAt: "2026-10-01T12:00:00Z",
        googleName: "Maria",
      }),
    ).toBe("Mari");
  });

  it("uses a display name that is not the e-mail fallback", () => {
    expect(
      initialDisplayName({
        displayName: "Mari",
        email: "maria@example.com",
        onboardedAt: null,
        googleName: "",
      }),
    ).toBe("Mari");
  });

  it("falls back to the Google name without a display name", () => {
    expect(
      initialDisplayName({
        displayName: null,
        email: "maria@example.com",
        onboardedAt: null,
        googleName: "Maria",
      }),
    ).toBe("Maria");
  });
});
