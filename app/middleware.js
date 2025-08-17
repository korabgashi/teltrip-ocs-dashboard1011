// middleware.js (at project root)
import { NextResponse } from "next/server";

function unauthorized(realm = "OCS Dashboard") {
  return new NextResponse("Authentication required.", {
    status: 401,
    headers: { "WWW-Authenticate": `Basic realm="${realm}", charset="UTF-8"` },
  });
}

export function middleware(req) {
  const { pathname } = req.nextUrl;

  if (
    pathname.startsWith("/_next/") ||
    pathname.startsWith("/public/") ||
    pathname.endsWith(".png") ||
    pathname.endsWith(".jpg") ||
    pathname.endsWith(".ico") ||
    pathname.endsWith(".svg")
  ) return NextResponse.next();

  const auth = req.headers.get("authorization");
  if (!auth?.startsWith("Basic ")) return unauthorized();

  try {
    const encoded = auth.split(" ")[1];
    const [user, pass] = Buffer.from(encoded, "base64").toString().split(":");
    const USER = process.env.LOGIN_USER || "admin";
    const PASS = process.env.LOGIN_PASS || "Teltrip#2025";
    if (user !== USER || pass !== PASS) return unauthorized();
  } catch {
    return unauthorized();
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image).*)"],
};
