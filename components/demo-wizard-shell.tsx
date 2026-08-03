"use client";

export function WizardShell({
  title,
  step,
  stepCount,
  onBack,
  onNext,
  nextLabel = "Continuar",
  backLabel = "Voltar",
  nextDisabled = false,
  heading,
  subtitle,
  bare = false,
  children,
}: {
  title: string;
  step: number;
  stepCount: number;
  onBack: () => void;
  onNext: () => void;
  nextLabel?: string;
  backLabel?: string;
  nextDisabled?: boolean;
  /** Question shown outside the card surface */
  heading?: string;
  subtitle?: string;
  /** When true, children render without the white card wrapper (for clickable card grids) */
  bare?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className="wizard-step-enter space-y-5">
      <div>
        <p className="text-sm text-cream/70">{title}</p>
        <div className="mt-3 flex gap-2" aria-label={`Passo ${step + 1} de ${stepCount}`}>
          {Array.from({ length: stepCount }, (_, i) => (
            <span
              key={i}
              className={`h-2 flex-1 rounded-full ${
                i <= step ? "bg-[var(--terracotta)]" : "bg-white/20"
              }`}
            />
          ))}
        </div>
      </div>

      {heading || subtitle ? (
        <div className="space-y-2 text-center">
          {heading ? (
            <h1 className="font-serif text-3xl leading-tight text-cream">{heading}</h1>
          ) : null}
          {subtitle ? (
            <p className="text-sm leading-6 text-cream/70">{subtitle}</p>
          ) : null}
        </div>
      ) : null}

      {bare ? (
        children
      ) : (
        <div className="rounded-3xl bg-surface p-4 text-[var(--ink-on-surface)] shadow-lg shadow-black/20">
          {children}
        </div>
      )}

      <div className="flex gap-3">
        <button
          type="button"
          onClick={onBack}
          className="h-12 flex-1 rounded-2xl border border-white/25 text-sm font-medium text-cream"
        >
          {backLabel}
        </button>
        <button
          type="button"
          onClick={onNext}
          disabled={nextDisabled}
          className="h-12 flex-1 rounded-2xl bg-[var(--terracotta)] text-sm font-semibold text-accent-contrast disabled:opacity-40"
        >
          {nextLabel}
        </button>
      </div>
    </div>
  );
}
