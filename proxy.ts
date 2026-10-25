import { NextResponse, type NextRequest } from "next/server";

// Cheap first gate: no refresh cookie means no session, so send admin pages to
// /login before rendering anything. The role check happens when the session is
// established (/api/auth/*), and the backend authorises every API call anyway.
const REFRESH_COOKIE = "baytna_rt";

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const hasSession = request.cookies.has(REFRESH_COOKIE);

  if (pathname === "/") {
    return NextResponse.redirect(new URL(hasSession ? "/dashboard" : "/login", request.url));
  }
  if (pathname === "/login") return NextResponse.next();
  if (!hasSession) return NextResponse.redirect(new URL("/login", request.url));
  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico).*)"],
};
