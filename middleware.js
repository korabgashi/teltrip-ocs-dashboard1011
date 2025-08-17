// middleware.js
import { NextResponse } from "next/server";

export function middleware(req) {
  const { pathname } = req.nextUrl;

  // Public paths (no auth)
  const publicPaths = ["/login", "/api/login", "/api/logout", "/favicon.ico"];
  if (
    publicPaths.some(p => pathname.startsWith(p)) ||
    pathname.startsWith("/_next/") ||
    pathname.startsWith("/public/") ||
    pathname.endsWith(".png") || pathname.endsWith(".jpg") ||
    pathname.endsWith(".jpeg") || pathname.endsWith(".svg") ||
    pathname.endsWith(".ico") || pathname.endsWith(".webp") ||
    pathname.endsWith(".css") || pathname.endsWith(".js") ||
    pathname.endsWith(".woff") || pathname.endsWith(".woff2")
  ) return NextResponse.next();

  // Check session cookie
  const session = req.cookies.get("session")?.value;
  if (!session) {
    const url = req.nextUrl.clone();
    url.pathname = "/login";
    url.searchParams.set("from", pathname);
    return NextResponse.redirect(url);
  }
  return NextResponse.next();
}

export const config = { matcher: ["/((?!_next/static|_next/image).*)"] };
