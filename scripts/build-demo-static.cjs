#!/usr/bin/env node
/**
 * Builds a public static demo (no Supabase, no middleware) for GitHub Pages.
 */
const { execSync } = require("node:child_process");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const bakRoot = path.join("/tmp", "juntos-demo-static-bak");
const moved = [];

function rimraf(dir) {
  fs.rmSync(dir, { recursive: true, force: true });
}

function moveAside(rel) {
  const from = path.join(root, rel);
  if (!fs.existsSync(from)) return;
  const to = path.join(bakRoot, rel);
  fs.mkdirSync(path.dirname(to), { recursive: true });
  fs.renameSync(from, to);
  moved.push([to, from]);
}

function restore() {
  for (const [from, to] of moved.reverse()) {
    fs.mkdirSync(path.dirname(to), { recursive: true });
    if (fs.existsSync(from)) fs.renameSync(from, to);
  }
}

process.on("exit", restore);
process.on("SIGINT", () => {
  restore();
  process.exit(1);
});
process.on("uncaughtException", (err) => {
  console.error(err);
  restore();
  process.exit(1);
});

rimraf(bakRoot);
fs.mkdirSync(bakRoot, { recursive: true });

moveAside("middleware.ts");
moveAside("app/(app)");
moveAside("app/login");
moveAside("app/signup");
moveAside("app/onboarding");
moveAside("app/settings");
moveAside("app/auth");
moveAside("app/demo");

const pagePath = path.join(root, "app/page.tsx");
const pageHad = fs.existsSync(pagePath);
if (pageHad) moveAside("app/page.tsx");

fs.writeFileSync(
  pagePath,
  `import { Suspense } from "react";
import { DemoApp } from "@/components/demo-app";

export default function Page() {
  return (
    <Suspense
      fallback={
        <main className="mx-auto flex min-h-dvh w-full max-w-lg items-center justify-center px-4">
          <p className="text-sm text-cream/70">Carregando Juntos…</p>
        </main>
      }
    >
      <DemoApp />
    </Suspense>
  );
}
`,
);

try {
  execSync("npx next build", {
    cwd: root,
    stdio: "inherit",
    env: {
      ...process.env,
      JUNTOS_STATIC_DEMO: "true",
      NEXT_PUBLIC_DEMO_MODE: "true",
      NEXT_PUBLIC_BASE_PATH: "/juntos",
      NEXT_PUBLIC_SUPABASE_URL: "https://YOUR_PROJECT.supabase.co",
      NEXT_PUBLIC_SUPABASE_ANON_KEY: "your_anon_key",
    },
  });
  console.log("Static demo build ready in out/");

  // GitHub Pages can cache index.html aggressively on phones.
  for (const file of ["index.html", "404.html"]) {
    const htmlPath = path.join(root, "out", file);
    if (!fs.existsSync(htmlPath)) continue;
    let html = fs.readFileSync(htmlPath, "utf8");
    if (!html.includes("Cache-Control")) {
      html = html.replace(
        "<head>",
        `<head><meta http-equiv="Cache-Control" content="no-cache, no-store, must-revalidate" /><meta http-equiv="Pragma" content="no-cache" /><meta http-equiv="Expires" content="0" />`,
      );
      fs.writeFileSync(htmlPath, html);
    }
  }
} finally {
  if (fs.existsSync(pagePath)) fs.unlinkSync(pagePath);
  restore();
  rimraf(bakRoot);
}
