"use client";

import { useCallback, useEffect, useRef, useState } from "react";

type ToastProps = {
  title: string;
  description?: string;
  icon?: string;
};

export function Toast({ title, description, icon }: ToastProps) {
  return (
    <div
      role="status"
      className="fixed inset-x-4 top-4 z-50 mx-auto flex max-w-md items-center gap-4 rounded-3xl bg-surface px-5 py-4 text-[#1a2238] shadow-2xl shadow-black/40"
    >
      {icon ? (
        <span aria-hidden="true" className="text-3xl">
          {icon}
        </span>
      ) : null}
      <div>
        <p className="text-lg font-semibold">{title}</p>
        {description ? (
          <p className="text-[#1a2238]/70">{description}</p>
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
