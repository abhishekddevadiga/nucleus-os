import { NextResponse, type NextRequest } from "next/server";
import { BRAND } from "@/lib/brand";

// Cheap redirect layer: no cookie -> /login. Real session validation happens
// server-side in the (app) layout and in every API handler.
export function middleware(req: NextRequest) {
  const hasSession = req.cookies.has(`${BRAND.slug}_session`);
  const { pathname } = req.nextUrl;
  const isPublic = pathname === "/login" || pathname.startsWith("/api/auth/") || pathname.startsWith("/api/cron/");

  if (!hasSession && !isPublic && !pathname.startsWith("/api/")) {
    const url = req.nextUrl.clone();
    url.pathname = "/login";
    return NextResponse.redirect(url);
  }
  if (hasSession && pathname === "/login") {
    const url = req.nextUrl.clone();
    url.pathname = "/";
    return NextResponse.redirect(url);
  }
  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)"],
};
