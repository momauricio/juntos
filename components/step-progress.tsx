const STEPS = 3;

export function StepProgress({ step }: { step: number }) {
  return (
    <div
      role="progressbar"
      aria-label={`Passo ${step} de ${STEPS}`}
      aria-valuemin={1}
      aria-valuemax={STEPS}
      aria-valuenow={step}
      className="mt-2.5 flex gap-2"
    >
      {Array.from({ length: STEPS }, (_, index) => (
        <span
          key={index}
          className={`h-2 flex-1 rounded-full ${index < step ? "bg-accent" : "bg-white/20"}`}
        />
      ))}
    </div>
  );
}
