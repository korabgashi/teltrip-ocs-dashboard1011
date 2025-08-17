// middleware.js
import { NextResponse } from "next/server";

function unauthorized(realm = "Protected") {
  return new NextResponse("Authentication required.", {
    status: 401,
    headers: {
      "WWW-Authenticate": `Basic realm="${realm}", charset="UTF-8"`,
    },
  });
}

export function middleware(req) {
  const { pathname } = req.nextUrl;

  // Allow Next internals and static assets without auth
  if (
    pathname.startsWith("/_next/") ||
    pathname.startsWith("/public/") ||
    pathname.endsWith(".png") ||
    pathname.endsWith(".jpg") ||
    pathname.endsWith(".ico") ||
    pathname.endsWith(".svg")
  ) {
    return NextResponse.next();
  }

  // Read HTTP Basic Auth header
  const auth = req.headers.get("authorization");
  if (!auth || !auth.startsWith("Basic ")) {
    return unauthorized("OCS Dashboard");
  }

  // Decode "Basic base64(user:pass)"
  try {
    const encoded = auth.split(" ")[1];
    const [user, pass] = Buffer.from(encoded, "base64").toString().split(":");

    const USER = process.env.LOGIN_USER || "admin";
    const PASS = process.env.LOGIN_PASS || "Teltrip#2025";

    if (user !== USER || pass !== PASS) {
      return unauthorized("OCS Dashboard");
    }
  } catch (_e) {
    return unauthorized("OCS Dashboard");
  }

  // Auth OK → continue
  return NextResponse.next();
}

// Protect everything except Next image/static
export const config = {
  matcher: ["/((?!_next/static|_next/image).*)"],
};
