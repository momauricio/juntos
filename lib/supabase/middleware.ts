import { createServerClient } from "@supabase/ssr";
import { type NextRequest, NextResponse } from "next/server";

import { authRedirectPath, safeRedirectPath } from "@/lib/auth-redirect";
import { isDemoMode } from "@/lib/demo-mode";

const AUTH_ROUTES = ["/login", "/signup"];
const PUBLIC_ROUTES = [...AUTH_ROUTES, "/auth/callback", "/demo"];
const SUPABASE_CACHE_HEADERS = ["Cache-Control", "Expires", "Pragma"];

function isRouteMatch(pathname: string, routes: string[]) {
  return routes.some(
    (route) => pathname === route || pathname.startsWith(`${route}/`),
  );
}

function redirectWithSupabaseState(
  request: NextRequest,
  response: NextResponse,
  destination: string,
) {
  const safeDestination = safeRedirectPath(destination, "/");
  const destinationUrl = new URL(safeDestination, request.url);
  const redirectUrl = request.nextUrl.clone();
  redirectUrl.pathname = destinationUrl.pathname;
  redirectUrl.search = destinationUrl.search;
  redirectUrl.hash = destinationUrl.hash;

  const redirectResponse = NextResponse.redirect(redirectUrl);

  response.cookies.getAll().forEach((cookie) => {
    redirectResponse.cookies.set(cookie);
  });

  SUPABASE_CACHE_HEADERS.forEach((header) => {
    const value = response.headers.get(header);

    if (value) {
      redirectResponse.headers.set(header, value);
    }
  });

  return redirectResponse;
}

export async function updateSession(request: NextRequest) {
  if (isDemoMode()) {
    const { pathname } = request.nextUrl;
    if (pathname === "/demo" || pathname.startsWith("/demo/")) {
      return NextResponse.next();
    }
    const demoUrl = request.nextUrl.clone();
    demoUrl.pathname = "/demo";
    demoUrl.search = request.nextUrl.search;
    return NextResponse.redirect(demoUrl);
  }

  let response = NextResponse.next({
    request,
  });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet, headers) {
          cookiesToSet.forEach(({ name, value }) => {
            request.cookies.set(name, value);
          });

          response = NextResponse.next({
            request,
          });

          cookiesToSet.forEach(({ name, value, options }) => {
            response.cookies.set(name, value, options);
          });

          Object.entries(headers).forEach(([key, value]) => {
            response.headers.set(key, value);
          });
        },
      },
    },
  );

  const { data } = await supabase.auth.getClaims();

  const isAuthenticated = Boolean(data?.claims);
  const { pathname } = request.nextUrl;

  if (isRouteMatch(pathname, AUTH_ROUTES) && isAuthenticated) {
    return redirectWithSupabaseState(
      request,
      response,
      authRedirectPath({
        next: request.nextUrl.searchParams.get("next"),
        code: request.nextUrl.searchParams.get("code"),
        fallback: "/",
      }),
    );
  }

  if (!isRouteMatch(pathname, PUBLIC_ROUTES) && !isAuthenticated) {
    const params = new URLSearchParams({
      next: `${pathname}${request.nextUrl.search}`,
    });

    return redirectWithSupabaseState(
      request,
      response,
      `/login?${params.toString()}`,
    );
  }

  return response;
}
