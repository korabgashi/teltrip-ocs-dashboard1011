// /lib/teltrip.js
const BASE = process.env.OCS_BASE_URL;
const TOKEN = process.env.OCS_TOKEN;
const DEFAULT_ACCOUNT_ID = parseInt(process.env.OCS_ACCOUNT_ID || "0", 10);
const USAGE_DAYS = parseInt(process.env.USAGE_DAYS || "7", 10); // API allows 1 week per call

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

function toYMD(d) { return d.toISOString().slice(0,10); }

async function fetchPackagesFor(subscriberId) {
  // listSubscriberPrepaidPackages (by subscriberId) -> packages[]
  // packageTemplate.prepaidpackagetemplateid/name, pckdatabyte, useddatabyte, tsactivationutc, tsexpirationutc
  const resp = await callOCS({ listSubscriberPrepaidPackages: { subscriberId } }); // :contentReference[oaicite:2]{index=2}
  const pkgs = resp?.listSubscriberPrepaidPackages?.packages || [];
  // pick highest priority or most recent activation
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

async function fetchUsageWeek(subscriberId) {
  // subscriberUsageOverPeriod (1 week max) -> we don’t need details, but call to confirm usage exists
  const end = new Date();
  const start = new Date(end.getTime() - Math.min(USAGE_DAYS,7) * 24 * 3600 * 1000);
  const payload = {
    subscriberUsageOverPeriod: {
      subscriber: { subscriberId }, // :contentReference[oaicite:3]{index=3}
      period: { start: toYMD(start), end: toYMD(end) } // 1-week window per guide :contentReference[oaicite:4]{index=4}
    }
  };
  const resp = await callOCS(payload);
  return resp?.subscriberUsageOverPeriod || null;
}

export async function fetchAllData(accountIdParam) {
  const accountId = parseInt(accountIdParam || DEFAULT_ACCOUNT_ID || "0", 10);
  if (!accountId) throw new Error("Provide accountId (env OCS_ACCOUNT_ID or ?accountId=)");

  // 1) get subscribers for account
  const subsResp = await callOCS({ listSubscriber: { accountId } });
  const subscribers = subsResp?.listSubscriber?.subscriberList || [];

  // 2) map basic fields (from listSubscriber)
  const rows = subscribers.map((s) => {
    const imsi = s?.imsiList?.[0]?.imsi ?? null;
    const iccid = s?.imsiList?.[0]?.iccid ?? s?.sim?.iccid ?? null;
    const phone = s?.phoneNumberList?.[0]?.phoneNumber ?? null;
    const st = latestByDate(s?.status) || null;
    return {
      iccid,
      lastUsageDate: s?.lastUsageDate ?? null,
      activationDate: s?.activationDate ?? null,

      // will be enriched by packages API:
      prepaidpackagetemplatename: null,
      prepaidpackagetemplateid: null,
      tsactivationutc: null,
      tsexpirationutc: null,
      pckdatabyte: null,
      useddatabyte: null,

      // extra visible columns
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

  // 3) enrich per-subscriber with package + usage info
  for (const r of rows) {
    if (!r._sid) continue;
    try {
      const pkg = await fetchPackagesFor(r._sid); // fills missing columns
      if (pkg) Object.assign(r, pkg);
      // optional: call usage (kept for future metrics / validation)
      await fetchUsageWeek(r._sid);
    } catch {
      // ignore per-subscriber errors; keep base row
    }
    delete r._sid;
  }

  return rows;
}
