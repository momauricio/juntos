import { NextResponse, type NextRequest } from "next/server";

import { authRedirectPath } from "@/lib/auth-redirect";
import { createClient } from "@/lib/supabase/server";

export async function GET(request: NextRequest) {
  const requestUrl = request.nextUrl.clone();
  const code = requestUrl.searchParams.get("code");

  if (code) {
    const supabase = await createClient();
    await supabase.auth.exchangeCodeForSession(code);
  }

  const destination = new URL(
    authRedirectPath({
      next: requestUrl.searchParams.get("next"),
      code: requestUrl.searchParams.get("invite_code"),
      fallback: "/",
    }),
    requestUrl.origin,
  );

  return NextResponse.redirect(destination);
}
