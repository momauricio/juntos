// Classes compartilhadas que espelham os componentes dos mockups (.btn, .input, .card…).

export const BTN_PRIMARY =
  "flex h-[52px] w-full items-center justify-center gap-2.5 rounded-2xl bg-accent px-5 text-base font-semibold text-accent-contrast shadow-[0_10px_24px_rgba(196,92,62,0.35)] transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-60";

export const BTN_SOFT =
  "flex h-[46px] w-full items-center justify-center gap-2.5 rounded-2xl bg-accent-soft px-5 text-base font-semibold text-ink transition hover:brightness-95";

export const BTN_OUTLINE =
  "flex h-[46px] w-full items-center justify-center rounded-2xl border border-cream/30 px-5 text-base font-semibold text-cream transition hover:bg-cream/10";

export const CARD =
  "rounded-[28px] bg-surface p-[18px] text-ink shadow-[0_18px_40px_rgba(0,0,0,0.22)]";

export const INPUT =
  "h-[50px] w-full rounded-xl border border-ink/20 bg-[#fbf7f2] px-3.5 text-base text-ink outline-none transition focus:border-accent focus:ring-4 focus:ring-accent-soft";

export const TEXTAREA =
  "w-full rounded-xl border border-ink/20 bg-[#fbf7f2] px-3.5 py-3 text-base text-ink outline-none transition focus:border-accent focus:ring-4 focus:ring-accent-soft";

export const FIELD_LABEL = "block space-y-1.5 text-sm font-semibold text-ink";

export const BACK_LINK =
  "inline-flex min-h-11 items-center gap-1.5 text-[15px] text-cream/70 transition hover:text-cream";

// Botão flutuante "＋ Colar link" (canto inferior direito, alinhado à coluna max-w-lg).
export const FAB =
  "fixed bottom-[max(2rem,env(safe-area-inset-bottom))] right-5 z-30 flex h-[52px] items-center gap-2.5 rounded-2xl bg-accent px-[22px] text-base font-semibold text-accent-contrast shadow-[0_10px_24px_rgba(196,92,62,0.35)] transition hover:brightness-110 sm:right-[max(1.25rem,calc(50%_-_16rem_+_1.25rem))]";

// Telas de entrada/onboarding (mockups 01–07): coluna estreita, botões de 52px.
export const SCREEN =
  "mx-auto flex min-h-dvh w-full max-w-md flex-col px-5 pb-8 pt-6 text-foreground";

export const EYEBROW =
  "text-xs font-semibold uppercase tracking-[0.24em] text-cream/60";

export const EYEBROW_ACCENT =
  "text-xs font-semibold uppercase tracking-[0.24em] text-accent";

export const TITLE = "text-[34px] font-medium leading-[1.12] text-cream";

export const SUBTITLE = "text-base leading-[1.55] text-cream/75";

export const BTN_WHITE =
  "flex h-[52px] w-full items-center justify-center gap-2.5 rounded-2xl bg-surface px-5 text-base font-semibold text-ink transition hover:bg-cream disabled:cursor-not-allowed disabled:opacity-60";

export const BTN_SOFT_LG =
  "flex h-[52px] w-full items-center justify-center gap-2.5 rounded-2xl bg-accent-soft px-5 text-base font-semibold text-ink transition hover:brightness-95 disabled:cursor-not-allowed disabled:opacity-60";

export const BTN_OUTLINE_LG =
  "flex h-[52px] w-full items-center justify-center gap-2.5 rounded-2xl border border-cream/30 px-5 text-base font-semibold text-cream transition hover:bg-cream/10 disabled:cursor-not-allowed disabled:opacity-60";

// Link sublinhado do rodapé ("Só quero dar uma olhada", "Pular por enquanto"…).
export const TEXT_LINK =
  "mx-auto block w-fit text-center text-[15px] font-semibold text-cream underline decoration-cream/40 underline-offset-4 transition hover:decoration-cream";

export const TEXT_LINK_QUIET =
  "mx-auto block w-fit text-center text-[15px] font-medium text-cream/70 underline decoration-cream/40 underline-offset-4 transition hover:text-cream";

export const LABEL = "mb-1.5 block text-sm font-semibold text-ink";

export const ERROR_TEXT = "text-sm font-medium text-[#a3402a]";

// Cabeçalho "Passo N de 3" acima da barra .dots.
export const STEP_LABEL = "text-sm text-cream/70";
