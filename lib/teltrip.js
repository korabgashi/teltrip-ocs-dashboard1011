const BASE = process.env.OCS_BASE_URL;
const TOKEN = process.env.OCS_TOKEN;
const DEFAULT_ACCOUNT_ID = parseInt(process.env.OCS_ACCOUNT_ID || "0", 10);

// Safe fetch: never crashes on non-JSON/empty
async function callOCS(payload) {
  if (!BASE) throw new Error("OCS_BASE_URL missing");
  if (!TOKEN) throw new Error("OCS_TOKEN missing");
  const url = `${BASE}?token=${encodeURIComponent(TOKEN)}`;
  const r = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
    cache: "no-store"
  });
  const text = await r.text();
  let data = null;
  try { data = text ? JSON.parse(text) : null; } catch { /* keep null */ }
  if (!r.ok) throw new Error(`HTTP ${r.status} ${r.statusText}${text ? " :: " + text.slice(0,300) : ""}`);
  return data ?? { _empty: true };
}

function latestByDate(arr) {
  if (!Array.isArray(arr) || arr.length === 0) return null;
  return arr.slice().sort((a,b)=>new Date(a.startDate||0)-new Date(b.startDate||0)).at(-1);
}

export async function fetchAllData(accountIdParam) {
  const accountId = parseInt(accountIdParam || DEFAULT_ACCOUNT_ID || "0", 10);
  if (!accountId) throw new Error("Provide accountId (env OCS_ACCOUNT_ID or ?accountId=)");

  // EXACT shape you posted: { status, listSubscriber: { subscriberList: [...] } }
  const resp = await callOCS({ listSubscriber: { accountId } });
  const items = resp?.listSubscriber?.subscriberList || [];

  // Map to table rows using ONLY fields we know exist from your JSON
  return items.map(s => {
    const imsi = s?.imsiList?.[0]?.imsi ?? null;
    const iccid = s?.imsiList?.[0]?.iccid ?? s?.sim?.iccid ?? null;
    const phone = s?.phoneNumberList?.[0]?.phoneNumber ?? null;
    const st = latestByDate(s?.status) || null;

    return {
      // original requested columns (some may be null if not in this response)
      iccid,
      lastUsageDate: s?.lastUsageDate ?? null,
      prepaidpackagetemplatename: null,
      activationDate: s?.activationDate ?? null,
      tsactivationutc: null,
      tsexpirationutc: null,
      prepaidpackagetemplateid: null,
      pckdatabyte: null,
      useddatabyte: null,
      subscriberUsageOverPeriod: null,

      // extra columns we CAN show now from subscriberList:
      imsi,
      phoneNumber: phone,
      simStatus: s?.sim?.status ?? null,
      esim: s?.sim?.esim ?? null,
      smdpServer: s?.sim?.smdpServer ?? null,
      activationCode: s?.sim?.activationCode ?? null,
      subscriberStatus: st?.status ?? null,
      account: s?.account ?? null,
      reseller: s?.reseller ?? null,
      prepaid: s?.prepaid ?? null,
      balance: s?.balance ?? null,
      lastMcc: s?.lastMcc ?? null,
      lastMnc: s?.lastMnc ?? null
    };
  });
}
