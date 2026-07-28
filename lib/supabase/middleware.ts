import { createServerClient } from "@supabase/ssr";
import { type NextRequest, NextResponse } from "next/server";

const AUTH_ROUTES = ["/login", "/signup"];
const PUBLIC_ROUTES = [...AUTH_ROUTES, "/auth/callback"];
const SUPABASE_CACHE_HEADERS = ["Cache-Control", "Expires", "Pragma"];

function isRouteMatch(pathname: string, routes: string[]) {
  return routes.some(
    (route) => pathname === route || pathname.startsWith(`${route}/`),
  );
}

function redirectWithSupabaseState(
  request: NextRequest,
  response: NextResponse,
  pathname: string,
) {
  const redirectUrl = request.nextUrl.clone();
  redirectUrl.pathname = pathname;
  redirectUrl.search = "";

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
    return redirectWithSupabaseState(request, response, "/");
  }

  if (!isRouteMatch(pathname, PUBLIC_ROUTES) && !isAuthenticated) {
    return redirectWithSupabaseState(request, response, "/login");
  }

  return response;
}
