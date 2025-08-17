import { NextResponse } from "next/server";

// compute the stateless token server-side, same as middleware
async function expectedToken() {
  const enc = new TextEncoder();
  const data = enc.encode(`${process.env.DASHBOARD_USER}:${process.env.DASHBOARD_PASS}:${process.env.SESSION_SECRET}`);
  const hash = await crypto.subtle.digest("SHA-256", data);
  return Buffer.from(new Uint8Array(hash)).toString("hex");
}

export async function POST(req) {
  try {
    const { user, pass } = await req.json();
    if (user !== process.env.DASHBOARD_USER || pass !== process.env.DASHBOARD_PASS) {
      return NextResponse.json({ ok:false, error:"Invalid credentials" }, { status: 401 });
    }
    const token = await expectedToken();
    const res = NextResponse.json({ ok:true });
    res.cookies.set("teltrip_auth", token, {
      httpOnly: true,
      secure: true,
      sameSite: "lax",
      path: "/",
      maxAge: 60 * 60 * 8, // 8h
    });
    return res;
  } catch (e) {
    return NextResponse.json({ ok:false, error: e.message || "Bad request" }, { status: 400 });
  }
}
