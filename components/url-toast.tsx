"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import { Toast } from "@/components/toast";

const VISIBLE_MS = 4000;

// Toast que chega pela URL (ex.: ?categoria-apagada=1): some sozinho e limpa
// o parâmetro, para não voltar ao recarregar.
export function UrlToast({ param, title }: { param: string; title: string }) {
  const router = useRouter();
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      setVisible(false);
      const url = new URL(window.location.href);
      url.searchParams.delete(param);
      router.replace(`${url.pathname}${url.search}`, { scroll: false });
    }, VISIBLE_MS);

    return () => window.clearTimeout(timeout);
  }, [param, router]);

  return visible ? <Toast check title={title} /> : null;
}
