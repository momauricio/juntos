"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

import { isDemoMode } from "@/lib/demo-mode";
import { livePause } from "@/lib/live-pause";
import { subscribeSpaceLive } from "@/lib/live-refresh";
import { createClient } from "@/lib/supabase/client";

/**
 * Mantém a tela atualizada com o que o outro do casal faz (spec §8, C9):
 * escuta o canal privado do espaço e faz router.refresh(). Não renderiza nada.
 */
export function SpaceLive({ spaceId }: { spaceId: string }) {
  const router = useRouter();

  useEffect(() => {
    // Sem Supabase configurado (ex.: demo) não há Realtime, nem erro no console.
    if (isDemoMode() || !process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
      return;
    }

    return subscribeSpaceLive({
      supabase: createClient(),
      spaceId,
      // Com formulário aberto, espera ele fechar (lib/live-pause.ts).
      onChange: () => livePause.request(() => router.refresh()),
      target: { window, document },
    });
  }, [router, spaceId]);

  return null;
}
