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

function normalize(arr) {
  return (arr || [])
    .map(a => ({
      id: a?.accountId ?? a?.id ?? null,
      name: a?.accountName ?? a?.name ?? (a?.label ?? (a?.id ? `Account ${a.id}` : null))
    }))
    .filter(a => a.id && a.name);
}

export async function GET(req) {
  try {
    // Try multiple likely ops; some tenants expose different names
    const attempts = [
      { body: { listAccount: {} }, pick: r => r?.listAccount?.accounts },
      { body: { listAccounts: {} }, pick: r => r?.listAccounts?.accounts },
      { body: { listResellerAccounts: {} }, pick: r => r?.listResellerAccounts?.accounts },
      { body: { listCustomerAccounts: {} }, pick: r => r?.listCustomerAccounts?.accounts }
    ];

    let accounts = [];
    for (const t of attempts) {
      try {
        const resp = await callOCS(t.body);
        const arr = t.pick(resp);
        if (Array.isArray(arr) && arr.length) {
          accounts = normalize(arr);
          break;
        }
      } catch (_) {}
    }

    // Fallback: if still empty, try to infer from listSubscriber of the default account
    if (accounts.length === 0 && process.env.OCS_ACCOUNT_ID) {
      try {
        const ls = await callOCS({ listSubscriber: { accountId: Number(process.env.OCS_ACCOUNT_ID) } });
        const subs = ls?.listSubscriber?.subscriberList || [];
        const name = subs?.[0]?.account || `Account ${process.env.OCS_ACCOUNT_ID}`;
        accounts = [{ id: Number(process.env.OCS_ACCOUNT_ID), name }];
      } catch (_) {}
    }

    return NextResponse.json({ ok: true, data: accounts });
  } catch (e) {
    return NextResponse.json({ ok: false, error: e.message }, { status: 500 });
  }
}
