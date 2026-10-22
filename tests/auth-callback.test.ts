import { describe, expect, it } from "vitest";

import {
  authErrorPath,
  parseAuthErrorReason,
  reasonFromCallbackParams,
  postLoginCallbackPath,
  reasonFromExchangeError,
  signInPathWithNext,
} from "@/lib/auth-callback";

describe("reasonFromCallbackParams", () => {
  it("maps access_denied to oauth_cancelado", () => {
    expect(
      reasonFromCallbackParams(new URLSearchParams("error=access_denied")),
    ).toBe("oauth_cancelado");
  });

  it("prioritizes expired error codes over access_denied", () => {
    expect(
      reasonFromCallbackParams(
        new URLSearchParams("error=access_denied&error_code=otp_expired"),
      ),
    ).toBe("link_invalido");
  });

  it("maps other provider errors to desconhecido", () => {
    expect(
      reasonFromCallbackParams(new URLSearchParams("error=server_error")),
    ).toBe("desconhecido");
  });

  it("returns null when there are no error params", () => {
    expect(reasonFromCallbackParams(new URLSearchParams("code=abc"))).toBeNull();
  });
});

describe("reasonFromExchangeError", () => {
  it("maps 4xx and bad code verifier to link_invalido", () => {
    expect(
      reasonFromExchangeError({ status: 400, code: "bad_code_verifier" }),
    ).toBe("link_invalido");
  });

  it("maps 5xx to desconhecido", () => {
    expect(reasonFromExchangeError({ status: 500 })).toBe("desconhecido");
  });

  it("maps errors without status to desconhecido", () => {
    expect(reasonFromExchangeError({})).toBe("desconhecido");
  });
});

describe("authErrorPath", () => {
  it("keeps a safe next path", () => {
    expect(authErrorPath("oauth_cancelado", "/items/1?x=1")).toBe(
      "/auth/erro?motivo=oauth_cancelado&next=%2Fitems%2F1%3Fx%3D1",
    );
  });

  it("drops unsafe next paths", () => {
    expect(authErrorPath("link_invalido", "//evil.com")).toBe(
      "/auth/erro?motivo=link_invalido",
    );
  });
});

describe("parseAuthErrorReason", () => {
  it("falls back to desconhecido for unknown values", () => {
    expect(parseAuthErrorReason("hack")).toBe("desconhecido");
  });
});

describe("signInPathWithNext", () => {
  it("points to /entrar without params", () => {
    expect(signInPathWithNext(null)).toBe("/entrar");
  });

  it("drops unsafe next paths", () => {
    expect(signInPathWithNext("//evil.com")).toBe("/entrar");
    expect(signInPathWithNext("https://evil.com/x")).toBe("/entrar");
  });

  it("keeps a safe next path", () => {
    expect(signInPathWithNext("/onboarding?code=AB")).toBe(
      "/entrar?next=%2Fonboarding%3Fcode%3DAB",
    );
  });

  it("keeps the invite code", () => {
    expect(signInPathWithNext("/items/1", " AB12 ")).toBe(
      "/entrar?next=%2Fitems%2F1&code=AB12",
    );
    expect(signInPathWithNext("//evil.com", "AB12")).toBe("/entrar?code=AB12");
  });
});

describe("postLoginCallbackPath", () => {
  it("sends next and invite_code to the callback", () => {
    expect(postLoginCallbackPath("/items/1", "AB12")).toBe(
      "/auth/callback?next=%2Fitems%2F1&invite_code=AB12",
    );
  });

  it("drops unsafe next and empty code", () => {
    expect(postLoginCallbackPath("//evil.com", "  ")).toBe("/auth/callback");
  });
});
