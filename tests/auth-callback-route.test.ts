import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { GET } from "@/app/auth/callback/route";

type QueryResult = { data: unknown; error: unknown };

const { exchangeCodeForSession, getUser, tables, from } = vi.hoisted(() => {
  const tables: Record<string, () => Promise<QueryResult>> = {};
  const from = vi.fn((table: string) => {
    const builder = {
      select: () => builder,
      eq: () => builder,
      maybeSingle: () =>
        tables[table]?.() ?? Promise.resolve({ data: null, error: null }),
    };
    return builder;
  });

  return {
    exchangeCodeForSession: vi.fn(),
    getUser: vi.fn(),
    tables,
    from,
  };
});

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(async () => ({
    auth: { exchangeCodeForSession, getUser },
    from,
  })),
}));

function callback(query: string) {
  return GET(new NextRequest(`http://localhost:3000/auth/callback?${query}`));
}

function location(response: Response) {
  return response.headers.get("location");
}

function signedIn({
  hasSpace,
  onboarded,
}: {
  hasSpace: boolean;
  onboarded: boolean;
}) {
  getUser.mockResolvedValue({ data: { user: { id: "user-1" } }, error: null });
  tables.space_members = async () => ({
    data: hasSpace ? { space_id: "space-1" } : null,
    error: null,
  });
  tables.profiles = async () => ({
    data: { onboarded_at: onboarded ? "2026-10-21T12:00:00Z" : null },
    error: null,
  });
}

describe("GET /auth/callback", () => {
  beforeEach(() => {
    exchangeCodeForSession.mockReset();
    getUser.mockReset();
    from.mockClear();
    delete tables.space_members;
    delete tables.profiles;
    getUser.mockResolvedValue({ data: { user: null }, error: null });
  });

  it("redirects provider errors without exchanging the code", async () => {
    const response = await callback("error=access_denied");

    expect(response.status).toBe(307);
    expect(location(response)).toMatch(/\/auth\/erro\?motivo=oauth_cancelado$/);
    expect(exchangeCodeForSession).not.toHaveBeenCalled();
  });

  it("redirects invalid codes to link_invalido", async () => {
    exchangeCodeForSession.mockResolvedValue({
      data: {},
      error: { status: 400, code: "bad_code_verifier", name: "AuthApiError" },
    });

    const response = await callback("code=bad");

    expect(location(response)).toContain("motivo=link_invalido");
  });

  it("redirects thrown exchange errors to desconhecido", async () => {
    exchangeCodeForSession.mockRejectedValue(new Error("network"));

    const response = await callback("code=bad");

    expect(location(response)).toContain("motivo=desconhecido");
  });

  it("goes to next after a successful exchange when the user has a space", async () => {
    exchangeCodeForSession.mockResolvedValue({ data: {}, error: null });
    signedIn({ hasSpace: true, onboarded: true });

    const response = await callback("code=ok&next=/items/1");

    expect(location(response)).toBe("http://localhost:3000/items/1");
    expect(from).toHaveBeenCalledWith("space_members");
    expect(from).toHaveBeenCalledWith("profiles");
  });

  it("ignores unsafe next after a successful exchange", async () => {
    exchangeCodeForSession.mockResolvedValue({ data: {}, error: null });
    signedIn({ hasSpace: true, onboarded: true });

    const response = await callback("code=ok&next=//evil.com");

    expect(location(response)).toBe("http://localhost:3000/");
  });

  it("asks for the name of a new user without a space", async () => {
    exchangeCodeForSession.mockResolvedValue({ data: {}, error: null });
    signedIn({ hasSpace: false, onboarded: false });

    const response = await callback("code=ok");

    expect(location(response)).toBe("http://localhost:3000/onboarding/nome");
  });

  it("sends an onboarded user without a space to /onboarding", async () => {
    exchangeCodeForSession.mockResolvedValue({ data: {}, error: null });
    signedIn({ hasSpace: false, onboarded: true });

    const response = await callback("code=ok&next=/items/1");

    expect(location(response)).toBe("http://localhost:3000/onboarding");
  });

  it("prioritizes the invite code", async () => {
    exchangeCodeForSession.mockResolvedValue({ data: {}, error: null });
    signedIn({ hasSpace: false, onboarded: false });

    const response = await callback("code=ok&invite_code=AB12");

    expect(location(response)).toBe(
      "http://localhost:3000/onboarding?code=AB12",
    );
  });

  it("routes without code when there is a session (login by e-mail code)", async () => {
    signedIn({ hasSpace: true, onboarded: true });

    const response = await callback("next=/settings");

    expect(exchangeCodeForSession).not.toHaveBeenCalled();
    expect(location(response)).toBe("http://localhost:3000/settings");
  });

  it("sends to /entrar without code and without session", async () => {
    const response = await callback("next=/items/1&invite_code=AB12");

    expect(location(response)).toBe(
      "http://localhost:3000/entrar?next=%2Fitems%2F1&code=AB12",
    );
  });

  it("falls back to a safe destination when the database fails", async () => {
    exchangeCodeForSession.mockResolvedValue({ data: {}, error: null });
    getUser.mockResolvedValue({ data: { user: { id: "user-1" } }, error: null });
    tables.space_members = async () => ({
      data: null,
      error: { message: "boom" },
    });

    const response = await callback("code=ok");

    expect(location(response)).toBe("http://localhost:3000/onboarding");
  });

  it("keeps next when the database throws", async () => {
    exchangeCodeForSession.mockResolvedValue({ data: {}, error: null });
    getUser.mockResolvedValue({ data: { user: { id: "user-1" } }, error: null });
    tables.profiles = async () => {
      throw new Error("network");
    };

    const response = await callback("code=ok&next=/items/1");

    expect(location(response)).toBe("http://localhost:3000/items/1");
  });
});
