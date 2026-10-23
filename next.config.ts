import type { NextConfig } from "next";
import { PHASE_PRODUCTION_BUILD } from "next/constants";

import { MISSING_SUPABASE_ENV_ERROR, missingSupabaseEnv } from "./lib/demo-mode";

const demoStatic = process.env.JUNTOS_STATIC_DEMO === "true";
const basePath = process.env.NEXT_PUBLIC_BASE_PATH || "";

const nextConfig: NextConfig = {
  ...(demoStatic
    ? {
        output: "export" as const,
        trailingSlash: true,
        images: { unoptimized: true },
        ...(basePath
          ? {
              basePath,
              assetPrefix: basePath,
            }
          : {}),
      }
    : {}),
};

export default function config(phase: string): NextConfig {
  if (phase === PHASE_PRODUCTION_BUILD && missingSupabaseEnv(process.env)) {
    throw new Error(MISSING_SUPABASE_ENV_ERROR);
  }
  return nextConfig;
}
