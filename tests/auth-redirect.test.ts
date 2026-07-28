import { describe, expect, it } from "vitest";

import { authRedirectPath, safeRedirectPath } from "@/lib/auth-redirect";

describe("safeRedirectPath", () => {
  it("accepts same-origin paths with query strings", () => {
    expect(safeRedirectPath("/onboarding?code=ABCD1234", "/")).toBe(
      "/onboarding?code=ABCD1234",
    );
  });

  it("rejects external or protocol-relative destinations", () => {
    expect(safeRedirectPath("https://example.com", "/")).toBe("/");
    expect(safeRedirectPath("//example.com/path", "/")).toBe("/");
  });
});

describe("authRedirectPath", () => {
  it("prefers a safe next path", () => {
    expect(
      authRedirectPath({
        next: "/onboarding?code=ABCD1234",
        code: "IGNORED",
        fallback: "/",
      }),
    ).toBe("/onboarding?code=ABCD1234");
  });

  it("uses invite code when next is unsafe", () => {
    expect(
      authRedirectPath({
        next: "https://example.com",
        code: "ABCD1234",
        fallback: "/",
      }),
    ).toBe("/onboarding?code=ABCD1234");
  });
});
