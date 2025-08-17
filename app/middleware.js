import { NextResponse } from "next/server";

// Stateless cookie check (no DB): token = sha256(user:pass:secret)
async function expectedToken() {
  const enc = new TextEncoder();
  const data = enc.encode(`${process.env.DASHBOARD_USER}:${process.env.DASHBOARD_PASS}:${process.env.SESSION_SECRET}`);
  const hash = await crypto.subtle.digest("SHA-256", data);
  return Buffer.from(new Uint8Array(hash)).toString("hex");
}

const ALLOW = [
  "/login",
  "/api/login",
  "/_next/static",
  "/_next/image",
  "/favicon.ico",
  "/logo.png",
];

export async function middleware(req) {
  const { pathname } = req.nextUrl;

  // allow public paths
  if (ALLOW.some(p => pathname.startsWith(p))) {
    return NextResponse.next();
  }

  const cookie = req.cookies.get("teltrip_auth")?.value || "";
  const good = await expectedToken();

  if (cookie === good) {
    return NextResponse.next();
  }

  // not authenticated → redirect to /login
  const url = req.nextUrl.clone();
  url.pathname = "/login";
  url.searchParams.set("next", pathname);
  return NextResponse.redirect(url);
}

export const config = {
  matcher: ["/((?!.*\\.).*)"], // all routes except direct file requests
};
