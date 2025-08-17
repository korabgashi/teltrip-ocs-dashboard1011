// middleware.js — only /login and login APIs are public
import { NextResponse } from "next/server";

export function middleware(req) {
  const { pathname } = req.nextUrl;
  const session = req.cookies.get("session")?.value;

  // always allow Next internals & static
  if (
    pathname.startsWith("/_next/") || pathname.startsWith("/public/") ||
    /\.(ico|png|jpg|jpeg|svg|webp|css|js|woff2?)$/.test(pathname)
  ) return NextResponse.next();

  const isLoginPage = pathname === "/login";
  const isLoginApi  = pathname.startsWith("/api/login");
  const isLogoutApi = pathname.startsWith("/api/logout");

  // allow login/logout endpoints and the login page
  if (isLoginPage || isLoginApi || isLogoutApi) {
    // if already logged in, keep them off the login page
    if (session && isLoginPage) {
      const url = req.nextUrl.clone(); url.pathname = "/";
      return NextResponse.redirect(url);
    }
    return NextResponse.next();
  }

  // protect everything else
  if (!session) {
    const url = req.nextUrl.clone();
    url.pathname = "/login";
    url.searchParams.set("from", pathname);
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
}
export const config = { matcher: ["/((?!_next/static|_next/image).*)"] };
