const STEPS = 3;

export function StepProgress({ step }: { step: number }) {
  return (
    <div
      role="progressbar"
      aria-label={`Passo ${step} de ${STEPS}`}
      aria-valuemin={1}
      aria-valuemax={STEPS}
      aria-valuenow={step}
      className="mt-3 grid grid-cols-3 gap-3"
    >
      {Array.from({ length: STEPS }, (_, index) => (
        <span
          key={index}
          className={`h-2 rounded-full ${index < step ? "bg-accent" : "bg-foreground/20"}`}
        />
      ))}
    </div>
  );
}
