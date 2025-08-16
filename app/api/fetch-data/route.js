import { NextResponse } from "next/server";

const BASE = process.env.OCS_BASE_URL;
const TOKEN = process.env.OCS_TOKEN;

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// internal helper: always return JSON
async function callOCS(body) {
  if (!BASE || !TOKEN) throw new Error("Missing OCS_BASE_URL / OCS_TOKEN");
  const url = `${BASE}?token=${encodeURIComponent(TOKEN)}`;
  const r = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
    cache: "no-store"
  });
  const txt = await r.text();
  let data = null; try { data = txt ? JSON.parse(txt) : null; } catch { data = { nonJson: txt }; }
  return { status: r.status, data: data ?? { empty: true } };
}

// POST: generic passthrough
export async function POST(req) {
  try {
    const body = await req.json();
    const out = await callOCS(body);
    return NextResponse.json({ ok: true, ...out });
  } catch (e) {
    return NextResponse.json({ ok: false, error: e.message }, { status: 500 });
  }
}

// GET: quick testing from the browser
// /api/ocs?op=listSubscriber&accountId=3771
// /api/ocs?op=package&subscriberId=5054672
// /api/ocs?op=usage&subscriberId=5054672&from=2025-07-10&to=2025-08-10
export async function GET(req) {
  try {
    const { searchParams } = new URL(req.url);
    const op = (searchParams.get("op") || "").toLowerCase();

    if (op === "listsubscriber") {
      const accountId = Number(searchParams.get("accountId"));
      const out = await callOCS({ listSubscriber: { accountId } });
      return NextResponse.json({ ok: true, ...out });
    }

    if (op === "package") {
      const subscriberId = Number(searchParams.get("subscriberId"));
      const out = await callOCS({ listSubscriberPrepaidPackage: { subscriberId } });
      return NextResponse.json({ ok: true, ...out });
    }

    if (op === "usage") {
      const subscriberId = Number(searchParams.get("subscriberId"));
      const fromDate = searchParams.get("from");
      const toDate = searchParams.get("to");
      const out = await callOCS({ subscriberUsageOverPeriod: { subscriberId, fromDate, toDate } });
      return NextResponse.json({ ok: true, ...out });
    }

    return NextResponse.json({ ok: false, error: "Unsupported GET. Use op=listSubscriber|package|usage." }, { status: 400 });
  } catch (e) {
    return NextResponse.json({ ok: false, error: e.message }, { status: 500 });
  }
}
