const BASE = process.env.OCS_BASE_URL;
const TOKEN = process.env.OCS_TOKEN;
const DEFAULT_ACCOUNT_ID = parseInt(process.env.OCS_ACCOUNT_ID || "0", 10);
const USAGE_DAYS = parseInt(process.env.USAGE_DAYS || "30", 10);

// ---------- core ----------
async function callOCS(payload) {
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
  Array.isArray(x?.subscriberList) ? x.subscriberList :
  Array.isArray(x?.prepaidPackageList) ? x.prepaidPackageList :
  [];

// ---------- helpers to try many tenant variants ----------
async function tryMany(tries) {
  for (const t of tries) {
    try {
      const resp = await callOCS(t.body);
      const pick = t.pick(resp);
      if (Array.isArray(pick) && pick.length) return pick;
    } catch (_) { /* keep trying */ }
  }
  return null;
}

async function fetchPackages(subscriberId, accountId) {
  // Try several op names + payload shapes + result shapes
  const tries = [
    // common
    { body: { listSubscriberPrepaidPackage: { subscriberId } }, pick: (r) => arr(r?.listSubscriberPrepaidPackage) },
    { body: { listSubscriberPrepaidPackage: { accountId, subscriberId } }, pick: (r) => arr(r?.listSubscriberPrepaidPackage) },
    { body: { listSubscriberPackage: { subscriberId } }, pick: (r) => arr(r?.listSubscriberPackage) },
    { body: { listSubscriberPackage: { accountId, subscriberId } }, pick: (r) => arr(r?.listSubscriberPackage) },

    // other tenants
    { body: { getSubscriberPrepaidPackages: { subscriberId } }, pick: (r) => arr(r) },
    { body: { getSubscriberPrepaidPackage: { subscriberId } }, pick: (r) => arr(r) },
    { body: { listPrepaidPackageBySubscriber: { subscriberId } }, pick: (r) => arr(r) },
    { body: { subscriberPrepaidPackageList: { subscriberId } }, pick: (r) => arr(r?.subscriberPrepaidPackageList) },
    { body: { prepaidPackageList: { subscriberId } }, pick: (r) => arr(r?.prepaidPackageList) }
  ];
  return (await tryMany(tries)) || [];
}

async function fetchUsage(subscriberId, accountId, fromDate, toDate) {
  const base = { subscriberId, fromDate, toDate };
  const tries = [
    { body: { subscriberUsageOverPeriod: base }, pick: (r) => arr(r?.subscriberUsageOverPeriod) },
    { body: { subscriberUsageOverPeriod: { accountId, ...base } }, pick: (r) => arr(r?.subscriberUsageOverPeriod) },
    { body: { listSubscriberUsage: base }, pick: (r) => arr(r?.listSubscriberUsage) },
    { body: { getSubscriberUsage: base }, pick: (r) => arr(r) },
    { body: { subscriberUsageList: base }, pick: (r) => arr(r?.subscriberUsageList) },
    { body: { usageOverPeriod: base }, pick: (r) => arr(r?.usageOverPeriod) }
  ];
  return (await tryMany(tries)) || [];
}

// small pMap to avoid hammering API
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

// ---------- main ----------
export async function fetchAllData(accountIdParam) {
  const ACCOUNT_ID = parseInt(accountIdParam || DEFAULT_ACCOUNT_ID || "0", 10);
  if (!BASE || !TOKEN || !ACCOUNT_ID) throw new Error("Missing env or accountId");

  // 1) subscribers (your shape)
  const subsResp = await callOCS({ listSubscriber: { accountId: ACCOUNT_ID } });
  const subscribers = subsResp?.listSubscriber?.subscriberList || [];

  const rows = subscribers.map((s) => {
    const iccid = s?.imsiList?.[0]?.iccid ?? s?.sim?.iccid ?? null;
    return {
      subscriberId: s?.subscriberId ?? null,
      iccid,
      // present in your JSON:
      activationDate: s?.activationDate ?? null,
      lastUsageDate: s?.lastUsageDate ?? null,

      // to fill:
      prepaidpackagetemplatename: null,
      prepaidpackagetemplateid: null,
      tsactivationutc: null,
      tsexpirationutc: null,
      pckdatabyte: null,
      useddatabyte: null,
      subscriberUsageOverPeriod: null
    };
  });

  if (!rows.length) return rows;

  const today = new Date();
  const toDate = today.toISOString().slice(0, 10);
  const fromDate = new Date(today.getTime() - USAGE_DAYS * 24 * 3600 * 1000).toISOString().slice(0, 10);

  // 2) packages
  await pMap(rows, async (row) => {
    if (!row.subscriberId) return;
    const pkgs = await fetchPackages(row.subscriberId, ACCOUNT_ID);
    const pkg = pkgs?.[0];
    if (!pkg) return;

    row.prepaidpackagetemplatename =
      pkg.prepaidPackageTemplateName ?? pkg.templateName ?? pkg.prepaidpackagetemplatename ?? null;
    row.prepaidpackagetemplateid =
      pkg.prepaidPackageTemplateId ?? pkg.templateId ?? pkg.prepaidpackagetemplateid ?? null;
    row.tsactivationutc = pkg.tsActivationUtc ?? pkg.tsactivationutc ?? null;
    row.tsexpirationutc = pkg.tsExpirationUtc ?? pkg.tsexpirationutc ?? null;
    row.pckdatabyte = pkg.pckDataByte ?? pkg.packageDataByte ?? pkg.pckdatabyte ?? null;
    row.useddatabyte = pkg.usedDataByte ?? pkg.useddatabyte ?? null;
  }, 8);

  // 3) usage
  await pMap(rows, async (row) => {
    if (!row.subscriberId) return;
    const usage = await fetchUsage(row.subscriberId, ACCOUNT_ID, fromDate, toDate);
    if (usage?.length) {
      row.subscriberUsageOverPeriod = usage;
      const last = usage[usage.length - 1];
      row.lastUsageDate = row.lastUsageDate || last?.date || last?.ts || last?.time || null;
    }
  }, 8);

  // remove helper id
  return rows.map(({ subscriberId, ...rest }) => rest);
}
