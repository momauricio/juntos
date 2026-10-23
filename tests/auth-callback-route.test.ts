import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { GET } from "@/app/auth/callback/route";

const { exchangeCodeForSession } = vi.hoisted(() => ({
  exchangeCodeForSession: vi.fn(),
}));

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(async () => ({ auth: { exchangeCodeForSession } })),
}));

function callback(query: string) {
  return GET(new NextRequest(`http://localhost:3000/auth/callback?${query}`));
}

describe("GET /auth/callback", () => {
  beforeEach(() => {
    exchangeCodeForSession.mockReset();
  });

  it("redirects provider errors without exchanging the code", async () => {
    const response = await callback("error=access_denied");

    expect(response.status).toBe(307);
    expect(response.headers.get("location")).toMatch(
      /\/auth\/erro\?motivo=oauth_cancelado$/,
    );
    expect(exchangeCodeForSession).not.toHaveBeenCalled();
  });

  it("redirects invalid codes to link_invalido", async () => {
    exchangeCodeForSession.mockResolvedValue({
      data: {},
      error: { status: 400, code: "bad_code_verifier", name: "AuthApiError" },
    });

    const response = await callback("code=bad");

    expect(response.headers.get("location")).toContain("motivo=link_invalido");
  });

  it("redirects thrown exchange errors to desconhecido", async () => {
    exchangeCodeForSession.mockRejectedValue(new Error("network"));

    const response = await callback("code=bad");

    expect(response.headers.get("location")).toContain("motivo=desconhecido");
  });

  it("redirects to next after a successful exchange", async () => {
    exchangeCodeForSession.mockResolvedValue({ data: {}, error: null });

    const response = await callback("code=ok&next=/items/1");

    expect(response.headers.get("location")).toBe(
      "http://localhost:3000/items/1",
    );
  });

  it("ignores unsafe next after a successful exchange", async () => {
    exchangeCodeForSession.mockResolvedValue({ data: {}, error: null });

    const response = await callback("code=ok&next=//evil.com");

    expect(response.headers.get("location")).toBe("http://localhost:3000/");
  });
});
