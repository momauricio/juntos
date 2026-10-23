import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, describe, expect, it, vi } from "vitest";

import { DemoShowcaseBanner } from "@/components/demo-showcase-banner";

import {
  MISSING_SUPABASE_ENV_ERROR,
  isDemoMode,
  missingSupabaseEnv,
  showcaseSignupHref,
} from "@/lib/demo-mode";

describe("isDemoMode", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("is on only with NEXT_PUBLIC_DEMO_MODE=true", () => {
    vi.stubEnv("NEXT_PUBLIC_DEMO_MODE", "true");
    expect(isDemoMode()).toBe(true);
  });

  it("does not turn on by itself when Supabase env is missing", () => {
    vi.stubEnv("NEXT_PUBLIC_DEMO_MODE", "");
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "");
    expect(isDemoMode()).toBe(false);

    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://YOUR_PROJECT.supabase.co");
    expect(isDemoMode()).toBe(false);
  });

  it("is off for other flag values", () => {
    for (const value of ["false", "1", "TRUE", "yes"]) {
      vi.stubEnv("NEXT_PUBLIC_DEMO_MODE", value);
      expect(isDemoMode()).toBe(false);
    }
  });
});

describe("missingSupabaseEnv", () => {
  const supabase = {
    NEXT_PUBLIC_SUPABASE_URL: "https://abc.supabase.co",
    NEXT_PUBLIC_SUPABASE_ANON_KEY: "anon",
  };

  it("is false with URL and anon key", () => {
    expect(missingSupabaseEnv(supabase)).toBe(false);
  });

  it("is true without any env", () => {
    expect(missingSupabaseEnv({})).toBe(true);
  });

  it("is true when URL or anon key is missing or empty", () => {
    expect(
      missingSupabaseEnv({ NEXT_PUBLIC_SUPABASE_ANON_KEY: "anon" }),
    ).toBe(true);
    expect(
      missingSupabaseEnv({ NEXT_PUBLIC_SUPABASE_URL: "https://abc.supabase.co" }),
    ).toBe(true);
    expect(
      missingSupabaseEnv({ ...supabase, NEXT_PUBLIC_SUPABASE_ANON_KEY: "" }),
    ).toBe(true);
  });

  it("is true with the placeholder URL", () => {
    expect(
      missingSupabaseEnv({
        ...supabase,
        NEXT_PUBLIC_SUPABASE_URL: "https://YOUR_PROJECT.supabase.co",
      }),
    ).toBe(true);
  });

  it("is true when the demo flag is not exactly 'true'", () => {
    expect(missingSupabaseEnv({ NEXT_PUBLIC_DEMO_MODE: "false" })).toBe(true);
    expect(missingSupabaseEnv({ NEXT_PUBLIC_DEMO_MODE: "1" })).toBe(true);
  });

  it("is false with the demo flag, even without Supabase env", () => {
    expect(missingSupabaseEnv({ NEXT_PUBLIC_DEMO_MODE: "true" })).toBe(false);
    expect(
      missingSupabaseEnv({
        NEXT_PUBLIC_DEMO_MODE: "true",
        NEXT_PUBLIC_SUPABASE_URL: "https://YOUR_PROJECT.supabase.co",
      }),
    ).toBe(false);
  });

  it("exports the build error message", () => {
    expect(MISSING_SUPABASE_ENV_ERROR).toBe(
      "Faltam NEXT_PUBLIC_SUPABASE_URL/ANON_KEY (ou defina NEXT_PUBLIC_DEMO_MODE=true para a vitrine)",
    );
  });
});

describe("showcaseSignupHref", () => {
  it("points to /entrar of the real app", () => {
    expect(
      showcaseSignupHref({ NEXT_PUBLIC_APP_URL: "https://juntos.app" }),
    ).toBe("https://juntos.app/entrar");
  });

  it("drops the trailing slash of the env", () => {
    expect(
      showcaseSignupHref({ NEXT_PUBLIC_APP_URL: "https://juntos.app/" }),
    ).toBe("https://juntos.app/entrar");
    expect(
      showcaseSignupHref({ NEXT_PUBLIC_APP_URL: "https://juntos.app//" }),
    ).toBe("https://juntos.app/entrar");
  });

  it("is null without the env", () => {
    expect(showcaseSignupHref({})).toBeNull();
    expect(showcaseSignupHref({ NEXT_PUBLIC_APP_URL: undefined })).toBeNull();
  });

  it("is null with an empty or blank env", () => {
    expect(showcaseSignupHref({ NEXT_PUBLIC_APP_URL: "" })).toBeNull();
    expect(showcaseSignupHref({ NEXT_PUBLIC_APP_URL: "   " })).toBeNull();
  });
});

describe("DemoShowcaseBanner", () => {
  it("shows only the text, without a link, when there is no signup href", () => {
    const html = renderToStaticMarkup(
      createElement(DemoShowcaseBanner, { signupHref: null }),
    );
    expect(html).toContain("Você está na vitrine do Juntos");
    expect(html).not.toContain("Criar nossa conta");
    expect(html).not.toContain("<a");
  });

  it("shows the signup link to /entrar of the real app", () => {
    const html = renderToStaticMarkup(
      createElement(DemoShowcaseBanner, {
        signupHref: showcaseSignupHref({
          NEXT_PUBLIC_APP_URL: "https://juntos.app/",
        }),
      }),
    );
    expect(html).toContain('href="https://juntos.app/entrar"');
    expect(html).toContain("Criar nossa conta");
  });
});
