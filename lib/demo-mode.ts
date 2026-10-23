type Env = Record<string, string | undefined>;

export const MISSING_SUPABASE_ENV_ERROR =
  "Faltam NEXT_PUBLIC_SUPABASE_URL/ANON_KEY (ou defina NEXT_PUBLIC_DEMO_MODE=true para a vitrine)";

export function isDemoMode(): boolean {
  return process.env.NEXT_PUBLIC_DEMO_MODE === "true";
}

export function missingSupabaseEnv(env: Env): boolean {
  if (env.NEXT_PUBLIC_DEMO_MODE === "true") return false;
  const url = env.NEXT_PUBLIC_SUPABASE_URL ?? "";
  const anonKey = env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";
  return !url || !anonKey || url.includes("YOUR_PROJECT");
}

/** "Criar nossa conta" da vitrine: `/entrar` do app real; null sem NEXT_PUBLIC_APP_URL. */
export function showcaseSignupHref(env: Env): string | null {
  const appUrl = (env.NEXT_PUBLIC_APP_URL ?? "").trim().replace(/\/+$/, "");
  if (!appUrl) return null;
  return `${appUrl}/entrar`;
}
