import { NextRequest } from "next/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { updateSession } from "@/lib/supabase/middleware";

const { getClaims } = vi.hoisted(() => ({ getClaims: vi.fn() }));

vi.mock("@supabase/ssr", () => ({
  createServerClient: vi.fn(() => ({ auth: { getClaims } })),
}));

function request(path: string) {
  return updateSession(new NextRequest(`http://localhost:3000${path}`));
}

function location(response: Response) {
  return response.headers.get("location");
}

describe("updateSession", () => {
  beforeEach(() => {
    vi.stubEnv("NEXT_PUBLIC_DEMO_MODE", "false");
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://example.supabase.co");
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY", "anon");
    getClaims.mockReset();
    getClaims.mockResolvedValue({ data: null, error: null });
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("redirects /login to /entrar keeping next and code", async () => {
    const response = await request("/login?next=%2Fitems%2F1&code=AB12");

    expect(location(response)).toBe(
      "http://localhost:3000/entrar?next=%2Fitems%2F1&code=AB12",
    );
  });

  it("redirects /signup to /entrar and drops unsafe next", async () => {
    const response = await request("/signup?next=%2F%2Fevil.com&code=AB12");

    expect(location(response)).toBe("http://localhost:3000/entrar?code=AB12");
  });

  it("sends protected routes without session to /entrar?next=", async () => {
    const response = await request("/items/1?x=1");

    expect(location(response)).toBe(
      "http://localhost:3000/entrar?next=%2Fitems%2F1%3Fx%3D1",
    );
  });

  it("sends / without session to the welcome screen", async () => {
    const response = await request("/");

    expect(location(response)).toBe("http://localhost:3000/boas-vindas");
  });

  it("lets public routes through without session", async () => {
    for (const path of [
      "/entrar",
      "/entrar/codigo?email=a%40b.com",
      "/boas-vindas",
      "/termos",
      "/privacidade",
      "/auth/erro",
    ]) {
      const response = await request(path);
      expect(location(response), path).toBeNull();
    }
  });

  it("keeps /onboarding/nome protected", async () => {
    const response = await request("/onboarding/nome");

    expect(location(response)).toBe(
      "http://localhost:3000/entrar?next=%2Fonboarding%2Fnome",
    );
  });

  it("sends signed-in users on /entrar through the post-login callback", async () => {
    getClaims.mockResolvedValue({ data: { claims: { sub: "u1" } }, error: null });

    const response = await request("/entrar?next=%2Fitems%2F1&code=AB12");

    expect(location(response)).toBe(
      "http://localhost:3000/auth/callback?next=%2Fitems%2F1&invite_code=AB12",
    );
  });

  it("lets signed-in users reach /", async () => {
    getClaims.mockResolvedValue({ data: { claims: { sub: "u1" } }, error: null });

    const response = await request("/");

    expect(location(response)).toBeNull();
  });
});
