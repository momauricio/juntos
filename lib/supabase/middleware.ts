import { createServerClient } from "@supabase/ssr";
import { type NextRequest, NextResponse } from "next/server";

import {
  postLoginCallbackPath,
  signInPathWithNext,
} from "@/lib/auth-callback";
import { safeRedirectPath } from "@/lib/auth-redirect";
import { isDemoMode } from "@/lib/demo-mode";

// Telas antigas de login com senha: viram redirect para /entrar.
const LEGACY_AUTH_ROUTES = ["/login", "/signup"];
// Telas de quem ainda não entrou; logado, segue para o destino pós-login.
const AUTH_ROUTES = ["/boas-vindas", "/entrar"];
const PUBLIC_ROUTES = [
  ...AUTH_ROUTES,
  "/c",
  "/auth/callback",
  "/auth/erro",
  "/demo",
  "/termos",
  "/privacidade",
];
const PUBLIC_EXACT_ROUTES = ["/"];
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

  const { pathname, searchParams } = request.nextUrl;

  if (isRouteMatch(pathname, LEGACY_AUTH_ROUTES)) {
    const url = request.nextUrl.clone();
    const destination = new URL(
      signInPathWithNext(searchParams.get("next"), searchParams.get("code")),
      request.url,
    );
    url.pathname = destination.pathname;
    url.search = destination.search;
    return NextResponse.redirect(url);
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

  if (isRouteMatch(pathname, AUTH_ROUTES) && isAuthenticated) {
    // O /auth/callback sem `code` consulta o banco e decide o destino.
    return redirectWithSupabaseState(
      request,
      response,
      postLoginCallbackPath(searchParams.get("next"), searchParams.get("code")),
    );
  }

  if (pathname === "/" && !isAuthenticated) {
    return redirectWithSupabaseState(
      request,
      response,
      `/boas-vindas${request.nextUrl.search}`,
    );
  }

  const isPublicRoute =
    PUBLIC_EXACT_ROUTES.includes(pathname) ||
    isRouteMatch(pathname, PUBLIC_ROUTES);

  if (!isPublicRoute && !isAuthenticated) {
    return redirectWithSupabaseState(
      request,
      response,
      signInPathWithNext(`${pathname}${request.nextUrl.search}`),
    );
  }

  return response;
}
