"use server";

import { revalidatePath } from "next/cache";

import { setItemView } from "@/lib/categories-data";
import { createClient } from "@/lib/supabase/server";
import type { ItemView } from "@/lib/types";

// Grava Grade/Compacta no perfil de quem está logado (C11). A tela já trocou
// antes (estado otimista); aqui só fica salvo para as próximas telas e
// aparelhos da pessoa. O par não é afetado (cada um grava só o seu perfil).
export async function saveItemView(view: ItemView): Promise<{ ok: boolean }> {
  if (view !== "grid" && view !== "compact") {
    return { ok: false };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { ok: false };
  }

  const result = await setItemView(supabase, user.id, view);

  if (result.ok) {
    // Limpa o cache do roteador: voltar (←) para uma lista já aberta mostra a
    // visualização nova, não a de antes.
    revalidatePath("/", "layout");
  }

  return { ok: result.ok };
}
