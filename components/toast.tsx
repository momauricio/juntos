"use client";

import { useCallback, useEffect, useRef, useState } from "react";

type ToastProps = {
  title: string;
  description?: string;
  icon?: string;
  // Círculo terracota com ✓ (mockup 23).
  check?: boolean;
};

export function Toast({ title, description, icon, check }: ToastProps) {
  return (
    <div
      role="status"
      className="fixed inset-x-4 top-[max(1rem,env(safe-area-inset-top))] z-50 mx-auto flex max-w-md items-center gap-2.5 rounded-[18px] bg-cream px-3.5 py-3 text-ink shadow-[0_14px_30px_rgba(0,0,0,0.35)]"
    >
      {check ? (
        <span
          aria-hidden="true"
          className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-accent font-bold text-accent-contrast"
        >
          ✓
        </span>
      ) : icon ? (
        <span aria-hidden="true" className="text-[22px]">
          {icon}
        </span>
      ) : null}
      <div>
        <p className="text-[15px] font-semibold">{title}</p>
        {description ? (
          <p className="text-[13px] text-ink/65">{description}</p>
        ) : null}
      </div>
    </div>
  );
}

// Mostra uma mensagem por alguns segundos. `show(texto)` reinicia o tempo.
export function useToast(durationMs = 4000) {
  const [message, setMessage] = useState<string | null>(null);
  const timeout = useRef<number | null>(null);

  useEffect(
    () => () => {
      if (timeout.current) {
        window.clearTimeout(timeout.current);
      }
    },
    [],
  );

  const show = useCallback(
    (text: string) => {
      if (timeout.current) {
        window.clearTimeout(timeout.current);
      }

      setMessage(text);
      timeout.current = window.setTimeout(() => setMessage(null), durationMs);
    },
    [durationMs],
  );

  return [message, show] as const;
}
