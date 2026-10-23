"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import { Toast } from "@/components/toast";

const VISIBLE_MS = 5000;

// Tela 8: aparece em /?bem-vindo=1, some em 5 s e limpa o parâmetro da URL.
export function WelcomeToast() {
  const router = useRouter();
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      setVisible(false);
      const url = new URL(window.location.href);
      url.searchParams.delete("bem-vindo");
      router.replace(`${url.pathname}${url.search}`, { scroll: false });
    }, VISIBLE_MS);

    return () => window.clearTimeout(timeout);
  }, [router]);

  if (!visible) {
    return null;
  }

  return (
    <Toast
      icon="💛"
      title="Vocês estão juntos no Juntos"
      description="Tudo que um adicionar aparece pro outro na hora."
    />
  );
}
