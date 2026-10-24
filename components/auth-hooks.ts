"use client";

import { useCallback, useEffect, useState, useSyncExternalStore } from "react";

function subscribeOnline(callback: () => void) {
  window.addEventListener("online", callback);
  window.addEventListener("offline", callback);

  return () => {
    window.removeEventListener("online", callback);
    window.removeEventListener("offline", callback);
  };
}

// `navigator.onLine`, atualizado pelos eventos online/offline.
export function useOnline() {
  return useSyncExternalStore(
    subscribeOnline,
    () => navigator.onLine,
    () => true,
  );
}

// Contagem regressiva em segundos. `restart(n)` recomeça de n.
export function useCountdown(initialSeconds: number) {
  const [remaining, setRemaining] = useState(initialSeconds);

  useEffect(() => {
    if (remaining <= 0) {
      return;
    }

    const timeout = window.setTimeout(() => {
      setRemaining((value) => Math.max(0, value - 1));
    }, 1000);

    return () => window.clearTimeout(timeout);
  }, [remaining]);

  const restart = useCallback((seconds: number) => {
    setRemaining(Math.max(0, Math.ceil(seconds)));
  }, []);

  return [remaining, restart] as const;
}
