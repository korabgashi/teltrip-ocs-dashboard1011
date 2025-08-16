const BASE = process.env.OCS_BASE_URL;
const TOKEN = process.env.OCS_TOKEN;
const DEFAULT_ACCOUNT_ID = parseInt(process.env.OCS_ACCOUNT_ID || "0", 10);
const USAGE_WEEKS = parseInt(process.env.USAGE_WEEKS || "4", 10);

function mustEnv(v, name) {
  if (!v) throw new Error(`${name} missing`);
  return v;
}

async function callOCS(payload) {
  mustEnv(BASE, "OCS_BASE_URL");
  mustEnv(TOKEN, "OCS_TOKEN");
  const url = `${BASE}?token=${encodeURIComponent(TOKEN)}`;
  const r = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
    cache: "no-store"
  });
  const txt = await r.text();
  let json = null; try { json = txt ? JSON.parse(txt) : null; } catch {}
  if (!r.ok) throw new Error(`HTTP ${r.status} ${r.statusText}${txt ? " :: " + txt.slice(0, 300) : ""}`);
  return json ?? {};
}

const toYMD = d => d.toISOString().slice(0, 10);
function latestByDate(arr) {
  if (!Array.isArray(arr) || !arr.length) return null;
  return arr.slice().sort((a,b)=>new Date(a.startDate||0)-new Date(b.startDate||0)).at(-1);
}

// ------------------ Packages ------------------
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

// ------------------ Weekly usage & cost ------------------
// API payload per guide (≤1 week) returns total.subscriberCost for the window.
// Example in the guide (by subscriberId) shows `total.subscriberCost` in the answer.  :contentReference[oaicite:2]{index=2}
async function fetchUsageWindow(subscriberId, startYMD, endYMD) {
  const resp = await callOCS({
    subscriberUsageOverPeriod: {
      subscriber: { subscriberId },
      period: { start: startYMD, end: endYMD }
    }
  });
  const total = resp?.subscriberUsageOverPeriod?.total || {};
  const qtyPerType = total?.quantityPerType || {};
  return {
    bytes: typeof qtyPerType["33"] === "number" ? qtyPerType["33"] : null,
    subscriberCost: typeof total?.subscriberCost === "number" ? total.subscriberCost : null,
    resellerCost: typeof total?.resellerCost === "number" ? total.resellerCost : null
  };
}

async function fetchRecentWeeksUsageAndCost(subscriberId, weeks = USAGE_WEEKS) {
  const out = [];
  let end = new Date(); // today (included)
  for (let i = 0; i < weeks; i++) {
    const start = new Date(end.getTime() - 7 * 24 * 3600 * 1000);
    const win = await fetchUsageWindow(subscriberId, toYMD(start), toYMD(end));
    out.push({
      start: toYMD(start),
      end: toYMD(end),
      bytes: win.bytes,
      subscriberCost: win.subscriberCost,
      resellerCost: win.resellerCost
    });
    end = start; // previous 7-day block
  }
  return out; // index 0 = most recent week
}

// ------------------ Main ------------------
export async function fetchAllData(accountIdParam) {
  const accountId = parseInt(accountIdParam || DEFAULT_ACCOUNT_ID || "0", 10);
  if (!accountId) throw new Error("Provide accountId (env OCS_ACCOUNT_ID or ?accountId=)");

  // 1) list subscribers via accountId (POST)
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

      // from packages
      prepaidpackagetemplatename: null,
      prepaidpackagetemplateid: null,
      tsactivationutc: null,
      tsexpirationutc: null,
      pckdatabyte: null,
      useddatabyte: null,

      // weekly usage & costs
      W1_bytes: null, W2_bytes: null, W3_bytes: null, W4_bytes: null,
      W1_subscriberCost: null, W2_subscriberCost: null, W3_subscriberCost: null, W4_subscriberCost: null,

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

    // 4 most recent weekly windows (bytes + subscriberCost)
    try {
      const weeks = await fetchRecentWeeksUsageAndCost(r._sid, 4);
      r.W1_bytes = weeks[0]?.bytes ?? null;
      r.W2_bytes = weeks[1]?.bytes ?? null;
      r.W3_bytes = weeks[2]?.bytes ?? null;
      r.W4_bytes = weeks[3]?.bytes ?? null;

      r.W1_subscriberCost = weeks[0]?.subscriberCost ?? null;
      r.W2_subscriberCost = weeks[1]?.subscriberCost ?? null;
      r.W3_subscriberCost = weeks[2]?.subscriberCost ?? null;
      r.W4_subscriberCost = weeks[3]?.subscriberCost ?? null;
    } catch {}

    delete r._sid;
  }

  return rows;
}
