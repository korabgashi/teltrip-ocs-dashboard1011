// Hardened OCS parsing + same table mapping
const BASE = process.env.OCS_BASE_URL;
const TOKEN = process.env.OCS_TOKEN;
const DEFAULT_ACCOUNT_ID = parseInt(process.env.OCS_ACCOUNT_ID || "0", 10);
const USAGE_DAYS = parseInt(process.env.USAGE_DAYS || "30", 10);

// always parse text first; fall back if not JSON
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
  const txt = await r.text();              // <- never throws
  let data = null;
  try { data = txt ? JSON.parse(txt) : null; } catch { data = null; }
  if (!r.ok) {
    const msg = `OCS ${r.status} ${r.statusText}${txt ? " :: " + txt.slice(0,300) : ""}`;
    throw new Error(msg);
  }
  // if upstream returned empty body, return an object so callers don't crash
  return data ?? { _empty: true, _raw: txt ?? "" };
}

// util
const arr = (x) =>
  Array.isArray(x) ? x :
  Array.isArray(x?.items) ? x.items :
  Array.isArray(x?.list) ? x.list :
  Array.isArray(x?.data) ? x.data :
  Array.isArray(x?.subscriberList) ? x.subscriberList :
  [];

// best-effort variants (still optional)
async function tryMany(tries) {
  for (const t of tries) {
    try {
      const resp = await callOCS(t.body);
      const pick = t.pick(resp);
      if (Array.isArray(pick) && pick.length) return pick;
    } catch {}
  }
  return null;
}
async function fetchPackages(subscriberId, accountId) {
  const tries = [
    { body: { listSubscriberPrepaidPackage: { subscriberId } }, pick: (r) => arr(r?.listSubscriberPrepaidPackage) },
    { body: { listSubscriberPrepaidPackage: { accountId, subscriberId } }, pick: (r) => arr(r?.listSubscriberPrepaidPackage) },
    { body: { listSubscriberPackage: { subscriberId } }, pick: (r) => arr(r?.listSubscriberPackage) },
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
    { body: { listSubscriberUsage: base }, pick: (r) => arr(r?.listSubscriberUsage) }
  ];
  return (await tryMany(tries)) || [];
}
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

export async function fetchAllData(accountIdParam) {
  const ACCOUNT_ID = parseInt(accountIdParam || DEFAULT_ACCOUNT_ID || "0", 10);
  if (!ACCOUNT_ID) throw new Error("Missing accountId");

  // subscribers (your shape: listSubscriber.subscriberList)
  const subsResp = await callOCS({ listSubscriber: { accountId: ACCOUNT_ID } });
  const subscribers = subsResp?.listSubscriber?.subscriberList || [];

  const rows = subscribers.map((s) => {
    const imsi = s?.imsiList?.[0]?.imsi ?? null;
    const iccid = s?.imsiList?.[0]?.iccid ?? s?.sim?.iccid ?? null;
    const phone = s?.phoneNumberList?.[0]?.phoneNumber ?? null;
    return {
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

      // extra columns we can show immediately
      imsi,
      phoneNumber: phone,
      simStatus: s?.sim?.status ?? null,
      prepaid: s?.prepaid ?? null,
      balance: s?.balance ?? null,
      account: s?.account ?? null,
      reseller: s?.reseller ?? null,
      lastMcc: s?.lastMcc ?? null,
      lastMnc: s?.lastMnc ?? null,

      _sid: s?.subscriberId ?? null
    };
  });

  if (!rows.length) return rows;

  // optional enrichment (will fill if tenant ops match)
  const today = new Date();
  const toDate = today.toISOString().slice(0, 10);
  const fromDate = new Date(today.getTime() - USAGE_DAYS * 24 * 3600 * 1000).toISOString().slice(0, 10);

  await pMap(rows, async (row) => {
    if (!row._sid) return;
    const pkgs = await fetchPackages(row._sid, ACCOUNT_ID);
    const pkg = pkgs?.[0];
    if (pkg) {
      row.prepaidpackagetemplatename =
        pkg.prepaidPackageTemplateName ?? pkg.templateName ?? null;
      row.prepaidpackagetemplateid =
        pkg.prepaidPackageTemplateId ?? pkg.templateId ?? null;
      row.tsactivationutc = pkg.tsActivationUtc ?? pkg.tsactivationutc ?? null;
      row.tsexpirationutc = pkg.tsExpirationUtc ?? pkg.tsexpirationutc ?? null;
      row.pckdatabyte = pkg.pckDataByte ?? pkg.packageDataByte ?? null;
      row.useddatabyte = pkg.usedDataByte ?? pkg.useddatabyte ?? null;
    }
    const usage = await fetchUsage(row._sid, ACCOUNT_ID, fromDate, toDate);
    if (usage?.length) {
      row.subscriberUsageOverPeriod = usage;
      const last = usage[usage.length - 1];
      row.lastUsageDate = row.lastUsageDate || last?.date || last?.ts || last?.time || null;
    }
  }, 8);

  return rows.map(({ _sid, ...rest }) => rest);
}
