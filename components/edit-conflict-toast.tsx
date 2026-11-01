"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import { Toast } from "@/components/toast";
import { EDIT_CONFLICT_PARAM } from "@/lib/edit-conflict";

const VISIBLE_MS = 4000;

// Depois de salvar por cima do par (?mexeu=id): some sozinho e limpa o parâmetro.
export function EditConflictToast({ message }: { message: string }) {
  const router = useRouter();
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      setVisible(false);
      const url = new URL(window.location.href);
      url.searchParams.delete(EDIT_CONFLICT_PARAM);
      router.replace(`${url.pathname}${url.search}`, { scroll: false });
    }, VISIBLE_MS);

    return () => window.clearTimeout(timeout);
  }, [router]);

  if (!visible) {
    return null;
  }

  return <Toast title={message} />;
}
