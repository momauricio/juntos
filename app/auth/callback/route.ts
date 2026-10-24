import { NextResponse, type NextRequest } from "next/server";

import {
  type AuthErrorReason,
  authErrorPath,
  reasonFromCallbackParams,
  reasonFromExchangeError,
  signInPathWithNext,
} from "@/lib/auth-callback";
import {
  authRedirectPath,
  postLoginPath,
  safeRedirectPath,
} from "@/lib/auth-redirect";
import { createClient } from "@/lib/supabase/server";

type SupabaseServerClient = Awaited<ReturnType<typeof createClient>>;

// Consulta se o usuário já tem espaço e se já passou pela tela "Seu nome".
// Devolve null se o banco falhar, para o login não quebrar.
async function loadOnboardingState(
  supabase: SupabaseServerClient,
  userId: string,
) {
  try {
    const [membership, profile] = await Promise.all([
      supabase
        .from("space_members")
        .select("space_id")
        .eq("user_id", userId)
        .maybeSingle(),
      supabase
        .from("profiles")
        .select("onboarded_at")
        .eq("id", userId)
        .maybeSingle(),
    ]);

    if (membership.error || profile.error) {
      return null;
    }

    return {
      hasSpace: Boolean(membership.data),
      onboarded: Boolean(profile.data?.onboarded_at),
    };
  } catch {
    return null;
  }
}

export async function GET(request: NextRequest) {
  const requestUrl = request.nextUrl.clone();
  const { searchParams, origin } = requestUrl;
  const code = searchParams.get("code");
  const inviteCode = searchParams.get("invite_code");
  const rawNext = safeRedirectPath(searchParams.get("next"), "");
  const next = authRedirectPath({
    next: rawNext,
    code: inviteCode,
    fallback: "",
  });

  const redirectTo = (path: string) =>
    NextResponse.redirect(new URL(path, origin));

  const callbackReason = reasonFromCallbackParams(searchParams);

  if (callbackReason) {
    return redirectTo(authErrorPath(callbackReason, next));
  }

  let supabase: SupabaseServerClient;

  try {
    supabase = await createClient();
  } catch {
    return redirectTo(authErrorPath("desconhecido", next));
  }

  if (code) {
    let exchangeReason: AuthErrorReason | null = null;

    try {
      const { error } = await supabase.auth.exchangeCodeForSession(code);

      if (error) {
        exchangeReason = reasonFromExchangeError(error);
      }
    } catch {
      exchangeReason = "desconhecido";
    }

    if (exchangeReason) {
      return redirectTo(authErrorPath(exchangeReason, next));
    }
  }

  let userId: string | null = null;

  try {
    const { data } = await supabase.auth.getUser();
    userId = data.user?.id ?? null;
  } catch {
    userId = null;
  }

  if (!userId) {
    // Sem `code` e sem sessão: volta para a tela de entrar.
    if (!code) {
      return redirectTo(signInPathWithNext(rawNext, inviteCode));
    }

    // O exchange deu certo, mas a sessão não pôde ser lida agora: segue para
    // um destino seguro (as páginas protegidas checam a sessão de novo).
    return redirectTo(
      authRedirectPath({ next, code: inviteCode, fallback: "/onboarding" }),
    );
  }

  const state = await loadOnboardingState(supabase, userId);

  if (!state) {
    return redirectTo(
      authRedirectPath({ next, code: inviteCode, fallback: "/onboarding" }),
    );
  }

  return redirectTo(
    postLoginPath({
      next: rawNext,
      inviteCode,
      hasSpace: state.hasSpace,
      onboarded: state.onboarded,
    }),
  );
}
