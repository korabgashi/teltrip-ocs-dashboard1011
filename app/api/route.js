import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

const BASE = process.env.OCS_BASE_URL;
const TOKEN = process.env.OCS_TOKEN;

async function callOCS(body) {
  if (!BASE || !TOKEN) throw new Error("Missing OCS env");
  const r = await fetch(`${BASE}?token=${encodeURIComponent(TOKEN)}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
    cache: "no-store"
  });
  const txt = await r.text();
  let json = null; try { json = txt ? JSON.parse(txt) : null; } catch {}
  if (!r.ok) throw new Error(`HTTP ${r.status} ${r.statusText}${txt ? " :: "+txt.slice(0,300) : ""}`);
  return json ?? {};
}

export async function GET() {
  try {
    const tries = [
      { body:{ listAccount:{} }, pick:r => r?.listAccount?.accounts },
      { body:{ listAccounts:{} }, pick:r => r?.listAccounts?.accounts },
      { body:{ listResellerAccounts:{} }, pick:r => r?.listResellerAccounts?.accounts }
    ];
    let accounts = [];
    for (const t of tries) {
      try {
        const resp = await callOCS(t.body);
        const arr = t.pick(resp);
        if (Array.isArray(arr) && arr.length) { accounts = arr; break; }
      } catch {}
    }
    const normalized = accounts.map(a => ({
      id: a?.accountId ?? a?.id ?? null,
      name: a?.accountName ?? a?.name ?? `Account ${a?.accountId ?? ""}`
    })).filter(a => a.id);
    return NextResponse.json({ ok:true, data: normalized });
  } catch (e) {
    return NextResponse.json({ ok:false, error:e.message }, { status: 500 });
  }
}
