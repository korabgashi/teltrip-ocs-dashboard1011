// Weekly usage + packages + subscriber list
const BASE = process.env.OCS_BASE_URL;
const TOKEN = process.env.OCS_TOKEN;
const DEFAULT_ACCOUNT_ID = parseInt(process.env.OCS_ACCOUNT_ID || "0", 10);

// the API guide allows 1-week windows; we’ll fetch N recent weeks
const USAGE_WEEKS = parseInt(process.env.USAGE_WEEKS || "4", 10);

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
  let json = null; try { json = text ? JSON.parse(text) : null; } catch {}
  if (!r.ok) throw new Error(`HTTP ${r.status} ${r.statusText}${text ? " :: " + text.slice(0,300) : ""}`);
  return json ?? {};
}

function latestByDate(arr) {
  if (!Array.isArray(arr) || !arr.length) return null;
  return arr.slice().sort((a,b)=>new Date(a.startDate||0)-new Date(b.startDate||0)).at(-1);
}
const toYMD = (d) => d.toISOString().slice(0,10);

// ---------- Packages ----------
async function fetchPackagesFor(subscriberId) {
  const resp = await callOCS({ listSubscriberPrepaidPackages: { subscriberId } });
  const pkgs = resp?.listSubscriberPrepaidPackages?.packages || [];
  if (!pkgs.length) return null;
  pkgs.sort((a,b)=> new Date(a.tsactivationutc||0) - new Date(b.tsactivationutc||0));
  const p = pkgs.at(-1);
  const tpl = p?.packageTemplate || {};
  return {
    prepaidpackagetemplatename: tpl.prepaidpackagetemplatename ?? null,
    prepaidpackagetemplateid: tpl.prepaidpackagetemplateid ?? null,
    tsactivationutc: p?.tsactivationutc ?? null,
    tsexpirationutc: p?.tsexpirationutc ?? null,
    pckdatabyte: p?.pckdatabyte ?? null,
    useddatabyte: p?.useddatabyte ?? null
  };
}

// ---------- Weekly usage ----------
function sumBytesFromUsage(usageArray) {
  // Try common keys; fall back to 0 if unknown
  if (!Array.isArray(usageArray)) return 0;
  let total = 0;
  for (const u of usageArray) {
    const candidates = [
      u?.useddatabyte, u?.dataByte, u?.bytes, u?.downloadBytes, u?.totalBytes
    ];
    const val = candidates.find(v => typeof v === "number");
    if (typeof val === "number" && Number.isFinite(val)) total += val;
  }
  return total;
}

async function fetchUsageWeekBytes(subscriberId, startDate, endDate) {
  // API requires 1-week window: { subscriberUsageOverPeriod: { subscriber:{subscriberId}, period:{start,end} } }
  const resp = await callOCS({
    subscriberUsageOverPeriod: {
      subscriber: { subscriberId },
      period: { start: startDate, end: endDate }
    }
  });
  const arr = resp?.subscriberUsageOverPeriod || resp?.usage || resp?.list || [];
  return sumBytesFromUsage(arr);
}

async function fetchRecentWeeksUsage(subscriberId, weeks = USAGE_WEEKS) {
  const out = [];
  // w1 = most recent week, then older
  let end = new Date();
  for (let i = 0; i < weeks; i++) {
    const start = new Date(end.getTime() - 7 * 24 * 3600 * 1000);
    const bytes = await fetchUsageWeekBytes(subscriberId, toYMD(start), toYMD(end));
    out.push({ start: toYMD(start), end: toYMD(end), bytes });
    // next window is the previous 7 days
    end = start;
  }
  return out;
}

// ---------- Main ----------
export async function fetchAllData(accountIdParam) {
  const accountId = parseInt(accountIdParam || DEFAULT_ACCOUNT_ID || "0", 10);
  if (!accountId) throw new Error("Provide accountId (env OCS_ACCOUNT_ID or ?accountId=)");

  // 1) list subscribers
  const subsResp = await callOCS({ listSubscriber: { accountId } });
  const subscribers = subsResp?.listSubscriber?.subscriberList || [];

  // 2) base rows
  const rows = subscribers.map((s) => {
    const imsi = s?.imsiList?.[0]?.imsi ?? null;
    const iccid = s?.imsiList?.[0]?.iccid ?? s?.sim?.iccid ?? null;
    const phone = s?.phoneNumberList?.[0]?.phoneNumber ?? null;
    const st = latestByDate(s?.status) || null;
    return {
      iccid,
      lastUsageDate: s?.lastUsageDate ?? null,
      activationDate: s?.activationDate ?? null,

      // to be filled from packages
      prepaidpackagetemplatename: null,
      prepaidpackagetemplateid: null,
      tsactivationutc: null,
      tsexpirationutc: null,
      pckdatabyte: null,
      useddatabyte: null,

      // subscriberUsageOverPeriod (weekly): we’ll add 4 columns usageW1..usageW4 (bytes)
      usageW1: null, usageW2: null, usageW3: null, usageW4: null,
      usageWeeksMeta: [], // [{start,end,bytes}] for export/debug

      // extra columns from subscriberList
      imsi,
      phoneNumber: phone,
      subscriberStatus: st?.status ?? null,
      simStatus: s?.sim?.status ?? null,
      esim: s?.sim?.esim ?? null,
      smdpServer: s?.sim?.smdpServer ?? null,
      activationCode: s?.sim?.activationCode ?? null,
      prepaid: s?.prepaid ?? null,
      balance: s?.balance ?? null,
      account: s?.account ?? null,
      reseller: s?.reseller ?? null,
      lastMcc: s?.lastMcc ?? null,
      lastMnc: s?.lastMnc ?? null,

      _sid: s?.subscriberId ?? null
    };
  });

  // 3) enrich per subscriber
  for (const r of rows) {
    if (!r._sid) continue;

    // packages
    try {
      const pkg = await fetchPackagesFor(r._sid);
      if (pkg) Object.assign(r, pkg);
    } catch {}

    // weekly usage (up to 4 weeks)
    try {
      const weeks = await fetchRecentWeeksUsage(r._sid, 4);
      r.usageWeeksMeta = weeks;
      // assign bytes to fixed columns (most recent first)
      r.usageW1 = weeks[0]?.bytes ?? null;
      r.usageW2 = weeks[1]?.bytes ?? null;
      r.usageW3 = weeks[2]?.bytes ?? null;
      r.usageW4 = weeks[3]?.bytes ?? null;
    } catch {}

    delete r._sid;
  }

  return rows;
}
