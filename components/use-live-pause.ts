"use client";

import { useEffect, useRef } from "react";

import { holdWhileOpen } from "@/lib/live-pause";

/**
 * Formulário aberto = Realtime pausado (lib/live-pause.ts). Ponha o ref no
 * <form>: dentro de um <details> pausa só enquanto ele está aberto.
 */
export function useLivePause<T extends Element>() {
  const ref = useRef<T>(null);

  useEffect(() => {
    if (!ref.current) return;
    return holdWhileOpen(ref.current);
  }, []);

  return ref;
}
