import { describe, expect, it } from "vitest";

import {
  authErrorPath,
  parseAuthErrorReason,
  reasonFromCallbackParams,
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
  it("drops unsafe next paths", () => {
    expect(signInPathWithNext("//evil.com")).toBe("/login");
  });

  it("keeps a safe next path", () => {
    expect(signInPathWithNext("/onboarding?code=AB")).toBe(
      "/login?next=%2Fonboarding%3Fcode%3DAB",
    );
  });
});
