import { cache } from "react";
import type { User } from "@supabase/supabase-js";

import { createClient } from "@/lib/supabase/server";

// Autenticação e espaço de quem está logado, memoizados por requisição
// (React cache()). layout.tsx, a page e generateMetadata de uma mesma
// renderização chamavam supabase.auth.getUser() e a consulta a
// space_members cada um por conta própria — cada chamada é uma ida e volta
// de rede. Com cache(), a primeira chamada busca e as próximas (mesmo em
// Server Components diferentes da mesma árvore) recebem o resultado já
// pronto, sem nova consulta.

// auth.getUser() revalida o JWT no servidor de Auth do Supabase (ao
// contrário de getSession(), que só lê o cookie) — por isso vale a pena
// memoizar.
export const getAuthUser = cache(async (): Promise<User | null> => {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user;
});

// space_id de quem está logado. null = sem espaço (vai para /onboarding).
export const getMySpaceId = cache(
  async (userId: string): Promise<string | null> => {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("space_members")
      .select("space_id")
      .eq("user_id", userId)
      .maybeSingle();

    if (error) {
      throw new Error("Não foi possível carregar o espaço.");
    }

    return (data?.space_id as string | undefined) ?? null;
  },
);
