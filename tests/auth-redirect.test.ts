import { describe, expect, it } from "vitest";

import {
  authRedirectPath,
  postLoginPath,
  safeRedirectPath,
} from "@/lib/auth-redirect";

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

describe("postLoginPath", () => {
  it("goes to the invite when there is an invite code", () => {
    expect(
      postLoginPath({
        next: "/items/1",
        inviteCode: "AB12",
        hasSpace: false,
        onboarded: false,
      }),
    ).toBe("/onboarding?code=AB12");
  });

  it("reads the invite code from next=/onboarding?code=", () => {
    expect(
      postLoginPath({
        next: "/onboarding?code=AB12",
        hasSpace: false,
        onboarded: true,
      }),
    ).toBe("/onboarding?code=AB12");
  });

  it("asks for the name when there is no space and no onboarding", () => {
    expect(
      postLoginPath({ next: "/items/1", hasSpace: false, onboarded: false }),
    ).toBe("/onboarding/nome");
  });

  it("goes to create/join a space when already onboarded", () => {
    expect(postLoginPath({ hasSpace: false, onboarded: true })).toBe(
      "/onboarding",
    );
  });

  it("goes to a safe next when the user has a space", () => {
    expect(
      postLoginPath({ next: "/items/1", hasSpace: true, onboarded: false }),
    ).toBe("/items/1");
  });

  it("goes home when the user has a space and no (safe) next", () => {
    expect(postLoginPath({ hasSpace: true, onboarded: true })).toBe("/");
    expect(
      postLoginPath({ next: "//evil.com", hasSpace: true, onboarded: true }),
    ).toBe("/");
  });
});
