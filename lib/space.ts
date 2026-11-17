import type { createClient } from "@/lib/supabase/server";
import { getMySpaceId } from "@/lib/session";
import type { SpaceRole } from "@/lib/types";

type SupabaseServerClient = Awaited<ReturnType<typeof createClient>>;

export type SpaceMember = {
  userId: string;
  role: SpaceRole;
  displayName: string;
};

export type MySpace = {
  id: string;
  name: string | null;
  // Em ordem de entrada (joined_at).
  members: SpaceMember[];
};

// Espaço de quem está logado, com os nomes das pessoas. null = sem espaço.
// O space_id vem de getMySpaceId (cache() por requisição): se o layout já
// resolveu o espaço nesta mesma renderização, não gera consulta de novo.
export async function loadMySpace(
  supabase: SupabaseServerClient,
  userId: string,
): Promise<MySpace | null> {
  const spaceId = await getMySpaceId(userId);

  if (!spaceId) {
    return null;
  }

  return loadSpaceDetails(supabase, spaceId);
}

// Nome e membros de um espaço já identificado (sem repetir a busca do
// space_id). Chamar direto quando o chamador for buscar itens/categorias em
// paralelo — assim essa consulta não bloqueia as outras (ver app/(app)/page.tsx).
export async function loadSpaceDetails(
  supabase: SupabaseServerClient,
  spaceId: string,
): Promise<MySpace> {
  const [spaceResult, membersResult] = await Promise.all([
    supabase.from("spaces").select("id,name").eq("id", spaceId).maybeSingle(),
    supabase
      .from("space_members")
      .select("user_id,role,joined_at")
      .eq("space_id", spaceId)
      .order("joined_at", { ascending: true }),
  ]);

  if (spaceResult.error || !spaceResult.data || membersResult.error) {
    throw new Error("Não foi possível carregar o espaço.");
  }

  const memberRows = (membersResult.data ?? []) as {
    user_id: string;
    role: SpaceRole;
  }[];
  const { data: profileRows, error: profilesError } = await supabase
    .from("profiles")
    .select("id,display_name")
    .in(
      "id",
      memberRows.map((member) => member.user_id),
    );

  if (profilesError) {
    throw new Error("Não foi possível carregar os perfis.");
  }

  const namesById = new Map(
    ((profileRows ?? []) as { id: string; display_name: string }[]).map(
      (profile) => [profile.id, profile.display_name],
    ),
  );

  return {
    id: spaceResult.data.id as string,
    name: (spaceResult.data.name as string | null) ?? null,
    members: memberRows.map((member, index) => ({
      userId: member.user_id,
      role: member.role,
      displayName: namesById.get(member.user_id) ?? `Pessoa ${index + 1}`,
    })),
  };
}
