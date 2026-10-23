import { showcaseSignupHref } from "@/lib/demo-mode";

// <a> comum: o export estático tem basePath /juntos e o link vai para o app real.
const SIGNUP_HREF = showcaseSignupHref({
  NEXT_PUBLIC_APP_URL: process.env.NEXT_PUBLIC_APP_URL,
});

export function DemoShowcaseBanner() {
  return (
    <div
      role="region"
      aria-label="Vitrine do Juntos"
      className="sticky top-0 z-20 border-b border-border bg-surface px-4 py-3 text-[var(--ink-on-surface)] shadow-md shadow-black/10"
    >
      <div className="flex items-center gap-3">
        <p className="flex-1 text-sm leading-5 text-accent-strong/80">
          Você está na vitrine do Juntos. Pra usar a dois de verdade, crie a
          conta de vocês.
        </p>
        <a
          href={SIGNUP_HREF}
          className="shrink-0 rounded-xl bg-accent px-3 py-2 text-sm font-semibold text-accent-contrast"
        >
          Criar nossa conta
        </a>
      </div>
    </div>
  );
}
