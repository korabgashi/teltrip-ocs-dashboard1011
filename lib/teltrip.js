// Teltrip data layer: subscribers + packages + usage/costs aggregated from 2025-06-01 → today
// Includes parallelization for both per-subscriber enrichment and week windows.

const BASE = process.env.OCS_BASE_URL;
const TOKEN = process.env.OCS_TOKEN;
const DEFAULT_ACCOUNT_ID = parseInt(process.env.OCS_ACCOUNT_ID || "0", 10);

// Range start fixed per your request
const RANGE_START_YMD = "2025-06-01";

function must(v, name) { if (!v) throw new Error(`${name} missing`); return v; }
const toYMD = (d) => d.toISOString().slice(0, 10);

async function callOCS(payload) {
  must(BASE, "OCS_BASE_URL"); must(TOKEN, "OCS_TOKEN");
  const url = `${BASE}?token=${encodeURIComponent(TOKEN)}`;

  // 25s safety timeout per request
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 25_000);

  const r = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
    cache: "no-store",
    signal: controller.signal
  }).finally(() => clearTimeout(timer));

  const text = await r.text();
  let json = null; try { json = text ? JSON.parse(text) : null; } catch {}
  if (!r.ok) throw new Error(`HTTP ${r.status} ${r.statusText}${text ? " :: " + text.slice(0,300) : ""}`);
  return json ?? {};
}

// --- small worker pool (used for subscribers & week windows) ---
async function pMap(list, fn, concurrency = 5) {
  const out = new Array(list.length);
  let i = 0;
  await Promise.all(
    Array.from({ length: Math.min(concurrency, list.length) }, async () => {
      while (i < list.length) {
        const idx = i++;
        out[idx] = await fn(list[idx], idx);
      }
    })
  );
  return out;
}

function latestByDate(arr) {
  if (!Array.isArray(arr) || !arr.length) return null;
  return arr.slice().sort((a,b)=>new Date(a.startDate||0)-new Date(b.startDate||0)).at(-1);
}

// ---------------- Packages ----------------
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

// ---------------- Usage windows (≤ 7 days per call) ----------------
function addDays(base, n) { const d = new Date(base); d.setDate(d.getDate() + n); return d; }
function parseYMD(s) { const [y,m,d]=s.split("-").map(Number); return new Date(Date.UTC(y, m-1, d)); }

function* weekWindows(startYMD, endYMD) {
  let start = parseYMD(startYMD);
  const endHard = parseYMD(endYMD);
  while (start <= endHard) {
    const end = addDays(start, 6);
    const endClamped = end > endHard ? endHard : end;
    yield { start: toYMD(start), end: toYMD(endClamped) };
    start = addDays(endClamped, 1);
  }
}

async function fetchUsageWindow(subscriberId, startYMD, endYMD) {
  // Guide payload: POST subscriberUsageOverPeriod { subscriber:{subscriberId}, period:{start,end} } (≤1 week)
  const resp = await callOCS({
    subscriberUsageOverPeriod: {
      subscriber: { subscriberId },
      period: { start: startYMD, end: endYMD }
    }
  });
  const root = resp?.subscriberUsageOverPeriod;
  const total = root?.total || {};
  const qty = total?.quantityPerType || {};

  const bytes = typeof qty["33"] === "number" ? qty["33"] : null; // data bytes type (common)
  const subscriberCost = Number.isFinite(total?.subscriberCost) ? total.subscriberCost : null;
  const resellerCost   = Number.isFinite(total?.resellerCost)   ? total.resellerCost   : null;
  return { bytes, subscriberCost, resellerCost };
}

async function fetchAggregatedUsage(subscriberId) {
  const todayYMD = toYMD(new Date());
  const windows = Array.from(weekWindows(RANGE_START_YMD, todayYMD));

  let sumBytes = 0, sumSubCost = 0, sumResCost = 0;

  // fetch week windows in parallel (cap to avoid hammering API)
  await pMap(windows, async (win) => {
    const { bytes, subscriberCost, resellerCost } = await fetchUsageWindow(subscriberId, win.start, win.end);
    if (Number.isFinite(bytes))          sumBytes   += bytes;
    if (Number.isFinite(subscriberCost)) sumSubCost += subscriberCost;
    if (Number.isFinite(resellerCost))   sumResCost += resellerCost;
  }, 6);

  return { sumBytes, sumSubCost, sumResCost };
}

// ---------------- Main ----------------
export async function fetchAllData(accountIdParam) {
  const accountId = parseInt(accountIdParam || DEFAULT_ACCOUNT_ID || "0", 10);
  if (!accountId) throw new Error("Provide accountId (env OCS_ACCOUNT_ID or ?accountId=)");

  // 1) subscribers
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
      imsi,
      phoneNumber: phone,
      activationDate: s?.activationDate ?? null,
      lastUsageDate: s?.lastUsageDate ?? null,
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

      // package fields
      prepaidpackagetemplatename: null,
      prepaidpackagetemplateid: null,
      tsactivationutc: null,
      tsexpirationutc: null,
      pckdatabyte: null,
      useddatabyte: null,

      // totals since 2025-06-01
      totalBytesSinceJun1: null,
      subscriberCostSinceJun1: null,
      resellerCostSinceJun1: null,

      _sid: s?.subscriberId ?? null
    };
  });

  // 3) enrich per subscriber (parallel)
  await pMap(rows, async (r) => {
    if (!r._sid) return;

    // packages (best-effort)
    try {
      const pkg = await fetchPackagesFor(r._sid);
      if (pkg) Object.assign(r, pkg);
    } catch {}

    // aggregated usage/costs from 2025-06-01 → today
    try {
      const aggr = await fetchAggregatedUsage(r._sid);
      r.totalBytesSinceJun1 = aggr.sumBytes;
      r.subscriberCostSinceJun1 = aggr.sumSubCost;
      r.resellerCostSinceJun1 = aggr.sumResCost;
    } catch {}

    delete r._sid;
  }, 5); // adjust concurrency if needed

  return rows;
}
