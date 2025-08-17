import { NextResponse } from "next/server";

// Runs on the Edge runtime (no Node 'Buffer'); use Web API 'atob'
function parseBasicAuth(header) {
  if (!header) return null;
  const [scheme, encoded] = header.split(" ");
  if (scheme !== "Basic" || !encoded) return null;
  try {
    const decoded = atob(encoded); // "user:pass"
    const idx = decoded.indexOf(":");
    if (idx === -1) return null;
    return { user: decoded.slice(0, idx), pass: decoded.slice(idx + 1) };
  } catch {
    return null;
  }
}

export function middleware(req) {
  const { DASHBOARD_USER, DASHBOARD_PASS } = process.env;
  const auth = parseBasicAuth(req.headers.get("authorization"));

  if (auth && auth.user === DASHBOARD_USER && auth.pass === DASHBOARD_PASS) {
    return NextResponse.next();
  }

  return new NextResponse("Auth required", {
    status: 401,
    headers: { "WWW-Authenticate": 'Basic realm="Teltrip Dashboard"' },
  });
}

// Protect everything except Next static assets & favicons
export const config = {
  matcher: [
    // block all routes except _next static/image and common public assets
    "/((?!_next/static|_next/image|favicon.ico).*)",
  ],
};
