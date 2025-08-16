import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

const BASE = process.env.OCS_BASE_URL;
const TOKEN = process.env.OCS_TOKEN;

// Optional: scope to a reseller via env or query ?resellerId=123
function getResellerId(req) {
  const url = new URL(req.url);
  const q = url.searchParams.get("resellerId");
  if (q && /^\d+$/.test(q)) return Number(q);
  if (process.env.OCS_RESELLER_ID && /^\d+$/.test(process.env.OCS_RESELLER_ID)) {
    return Number(process.env.OCS_RESELLER_ID);
  }
  return undefined;
}

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
    const resellerId = getResellerId(req);

    // 1) Per your guide: try listResellerAccount (singular) first
    //    If resellerId is provided, include it; otherwise call without to list all.
    const primaryBodies = [
      resellerId ? { listResellerAccount: { resellerId } } : { listResellerAccount: {} },
    ];

    // 2) Fallbacks for different tenants
    const fallbackBodies = [
      { listAccount: {} },
      { listAccounts: {} },
      { listResellerAccounts: {} },
      { listCustomerAccounts: {} }
    ];

    let accounts = [];
    for (const body of [...primaryBodies, ...fallbackBodies]) {
      try {
        const resp = await callOCS(body);
        const arr =
          resp?.listResellerAccount?.accounts ??
          resp?.listAccount?.accounts ??
          resp?.listAccounts?.accounts ??
          resp?.listResellerAccounts?.accounts ??
          resp?.listCustomerAccounts?.accounts ??
          [];
        if (Array.isArray(arr) && arr.length) {
          accounts = normalize(arr);
          break;
        }
      } catch (_) {}
    }

    // 3) Ultimate fallback: show the default env account (so UI still works)
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
