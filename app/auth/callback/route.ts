import { NextResponse, type NextRequest } from "next/server";

import {
  type AuthErrorReason,
  authErrorPath,
  reasonFromCallbackParams,
  reasonFromExchangeError,
} from "@/lib/auth-callback";
import { authRedirectPath } from "@/lib/auth-redirect";
import { createClient } from "@/lib/supabase/server";

export async function GET(request: NextRequest) {
  const requestUrl = request.nextUrl.clone();
  const { searchParams, origin } = requestUrl;
  const code = searchParams.get("code");
  const inviteCode = searchParams.get("invite_code");
  const next = authRedirectPath({
    next: searchParams.get("next"),
    code: inviteCode,
    fallback: "",
  });

  const callbackReason = reasonFromCallbackParams(searchParams);

  if (callbackReason) {
    return NextResponse.redirect(
      new URL(authErrorPath(callbackReason, next), origin),
    );
  }

  if (code) {
    let exchangeReason: AuthErrorReason | null = null;

    try {
      const supabase = await createClient();
      const { error } = await supabase.auth.exchangeCodeForSession(code);

      if (error) {
        exchangeReason = reasonFromExchangeError(error);
      }
    } catch {
      exchangeReason = "desconhecido";
    }

    if (exchangeReason) {
      return NextResponse.redirect(
        new URL(authErrorPath(exchangeReason, next), origin),
      );
    }
  }

  const destination = new URL(
    authRedirectPath({ next, code: inviteCode, fallback: "/" }),
    origin,
  );

  return NextResponse.redirect(destination);
}
