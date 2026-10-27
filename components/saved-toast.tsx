"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import { Toast } from "@/components/toast";
import { savedToastCopy } from "@/lib/capture-link";
import type { ItemStatus } from "@/lib/types";

const VISIBLE_MS = 4000;

// Depois de salvar um lugar (?salvo=want|done): some sozinho e limpa o parâmetro.
export function SavedToast({ status }: { status: ItemStatus }) {
  const router = useRouter();
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      setVisible(false);
      const url = new URL(window.location.href);
      // No quadro, "Já fizemos" só é o padrão enquanto há ?salvo=done: fixa a aba.
      if (
        url.pathname === "/" &&
        url.searchParams.get("salvo") === "done" &&
        !url.searchParams.has("status")
      ) {
        url.searchParams.set("status", "done");
      }
      url.searchParams.delete("salvo");
      router.replace(`${url.pathname}${url.search}`, { scroll: false });
    }, VISIBLE_MS);

    return () => window.clearTimeout(timeout);
  }, [router]);

  if (!visible) {
    return null;
  }

  return <Toast title={savedToastCopy(status)} />;
}
