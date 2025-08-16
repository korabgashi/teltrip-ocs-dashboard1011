import { NextResponse } from "next/server";

const BASE = process.env.OCS_BASE_URL;
const TOKEN = process.env.OCS_TOKEN;

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req) {
  try {
    if (!BASE || !TOKEN) throw new Error("Missing OCS_BASE_URL / OCS_TOKEN");
    const body = await req.json();
    const url = `${BASE}?token=${encodeURIComponent(TOKEN)}`;
    const r = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      cache: "no-store"
    });
    const txt = await r.text(); // upstream may return non-JSON or empty
    let data; try { data = txt ? JSON.parse(txt) : null; } catch { data = { nonJson: txt }; }
    return NextResponse.json({ ok: true, status: r.status, data: data ?? { empty: true } });
  } catch (e) {
    return NextResponse.json({ ok: false, error: e.message }, { status: 500 });
  }
}
