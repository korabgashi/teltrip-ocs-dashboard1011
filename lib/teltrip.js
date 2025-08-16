// /lib/teltrip.js  (REPLACE ALL)
const BASE = process.env.OCS_BASE_URL;
const TOKEN = process.env.OCS_TOKEN;
const DEFAULT_ACCOUNT_ID = parseInt(process.env.OCS_ACCOUNT_ID || "0", 10);
const USAGE_DAYS = parseInt(process.env.USAGE_DAYS || "30", 10);

// --- core fetch ---------------------------------------------------------------
async function callOCS(payload) {
  if (!BASE) throw new Error("OCS_BASE_URL is not set");
  if (!TOKEN) throw new Error("OCS_TOKEN is not set");
  const url = `${BASE}?token=${encodeURIComponent(TOKEN)}`;
  const r = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
    cache: "no-store"
  });
  if (!r.ok) {
    let t = "";
    try { t = await r.text(); } catch {}
    throw new Error(`OCS ${r.status} ${r.statusText} :: ${t.slice(0,300)}`);
  }
  return r.json();
}

const arr = (x) =>
  Array.isArray(x) ? x :
  Array.isArray(x?.items) ? x.items :
  Array.isArray(x?.list) ? x.list :
  Array.isArray(x?.data) ? x.data :
  [];

// --- extractors for various tenant shapes ------------------------------------
function pickPackages(resp) {
  // try common locations
  return (
    arr(resp?.listSubscriberPrepaidPackage) ||
    arr(resp?.subscriberPrepaidPackageList) ||
    arr(resp?.prepaidPackageList) ||
    arr(resp)
  );
}

function pickUsage(resp) {
  return (
    arr(resp?.subscriberUsageOverPeriod) ||
    arr(resp?.usageOverPeriod) ||
    arr(resp)
  );
}

// --- main ---------------------------------------------------------------------
export async function fetchAllData(accountIdParam) {
  const ACCOUNT_ID = parseInt(accountIdParam || DEFAULT_ACCOUNT_ID || "0", 10);
  if (!ACCOUNT_ID) throw new Error("Missing accountId");

  // 1) subscribers
  const subsResp = await callOCS({ listSubscriber: { accountId: ACCOUNT_ID } });
  // your JSON shows: listSubscriber.subscriberList
  const subscribers = subsResp?.listSubscriber?.subscriberList || [];

  // map of id -> base row
  const baseRows = subscribers.map((s) => {
    const subscriberId = s?.subscriberId ?? null;
    // ICCID in your JSON lives under imsiList[0].iccid
    const iccid =
      s?.imsiList?.[0]?.iccid ??
      s?.sim?.iccid ??
      null;

    return {
      subscriberId,
      iccid,
      lastUsageDate: s?.lastUsageDate ?? null,
      activationDate: s?.activationDate ?? null,

      // to be filled by package/usage calls:
      prepaidpackagetemplatename: null,
      prepaidpackagetemplateid: null,
      tsactivationutc: null,
      tsexpirationutc: null,
      pckdatabyte: null,
      useddatabyte: null,
      subscriberUsageOverPeriod: null
    };
  });

  // nothing to do
  const ids = baseRows.map(r => r.subscriberId).filter(Boolean);
  if (ids.length === 0) return baseRows;

  // Helper to run N promises in parallel with a cap
  async function pMap(list, fn, concurrency = 8) {
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

  const today = new Date();
  const toDate = today.toISOString().slice(0, 10);
  const fromDate = new Date(today.getTime() - USAGE_DAYS * 24 * 3600 * 1000)
    .toISOString()
    .slice(0, 10);

  // 2) fetch packages per-subscriber (best-effort)
  await pMap(baseRows, async (row) => {
    if (!row.subscriberId) return;
    try {
      const pkgResp = await callOCS({
        listSubscriberPrepaidPackage: { subscriberId: row.subscriberId }
      });
      const pkg = pickPackages(pkgResp)[0];
      if (pkg) {
        row.prepaidpackagetemplatename =
          pkg.prepaidPackageTemplateName ?? pkg.templateName ?? pkg.prepaidpackagetemplatename ?? null;
        row.prepaidpackagetemplateid =
          pkg.prepaidPackageTemplateId ?? pkg.templateId ?? pkg.prepaidpackagetemplateid ?? null;
        row.tsactivationutc = pkg.tsActivationUtc ?? pkg.tsactivationutc ?? null;
        row.tsexpirationutc = pkg.tsExpirationUtc ?? pkg.tsexpirationutc ?? null;
        row.pckdatabyte = pkg.pckDataByte ?? pkg.packageDataByte ?? pkg.pckdatabyte ?? null;
        row.useddatabyte = pkg.usedDataByte ?? pkg.useddatabyte ?? null;
      }
    } catch {}
  }, 8);

  // 3) usage over period (last N days)
  await pMap(baseRows, async (row) => {
    if (!row.subscriberId) return;
    try {
      const usageResp = await callOCS({
        subscriberUsageOverPeriod: {
          subscriberId: row.subscriberId,
          fromDate,
          toDate
        }
      });
      const usage = pickUsage(usageResp);
      if (usage?.length) {
        row.subscriberUsageOverPeriod = usage;
        // if your API returns daily buckets with a date/ts, lastUsageDate from here (fallback)
        const last = usage[usage.length - 1];
        row.lastUsageDate = row.lastUsageDate || last?.date || last?.ts || last?.time || null;
      }
    } catch {}
  }, 8);

  // strip helper field
  return baseRows.map(({ subscriberId, ...rest }) => rest);
}
