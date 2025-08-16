const BASE = process.env.OCS_BASE_URL;
const TOKEN = process.env.OCS_TOKEN;
const DEFAULT_ACCOUNT_ID = parseInt(process.env.OCS_ACCOUNT_ID || "0", 10);
const USAGE_DAYS = parseInt(process.env.USAGE_DAYS || "30", 10);

// Core POST to OCS
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
    let details = "";
    try { details = await r.text(); } catch {}
    throw new Error(`OCS HTTP ${r.status} ${r.statusText} :: ${details.slice(0,500)}`);
  }
  return await r.json();
}

// Try to read arrays from various shapes
function pickArray(obj) {
  if (!obj) return [];
  if (Array.isArray(obj)) return obj;
  if (Array.isArray(obj.items)) return obj.items;
  if (Array.isArray(obj.list)) return obj.list;
  if (Array.isArray(obj.data)) return obj.data;
  return [];
}

/**
 * fetchAllData(accountId?)
 * - Normalizes into rows for the table.
 * - Uses:
 *   - listSubscriber → listSubscriber.subscriberList
 *   - listSubscriberPrepaidPackage (best guess op name; adjust if your tenant differs)
 *   - subscriberUsageOverPeriod (best guess op name; adjust if your tenant differs)
 */
export async function fetchAllData(accountIdParam) {
  const ACCOUNT_ID = parseInt(accountIdParam || DEFAULT_ACCOUNT_ID || "0", 10);
  if (!ACCOUNT_ID) throw new Error("Missing accountId (env OCS_ACCOUNT_ID or query ?accountId=)");

  const today = new Date();
  const toDate = today.toISOString().slice(0, 10);
  const fromDate = new Date(today.getTime() - USAGE_DAYS * 24 * 3600 * 1000)
    .toISOString()
    .slice(0, 10);

  // 1) Subscribers (your payload returns listSubscriber.subscriberList)
  const subsResp = await callOCS({ listSubscriber: { accountId: ACCOUNT_ID } });
  const subscribers = subsResp?.listSubscriber?.subscriberList || [];

  const rows = [];
  for (const s of subscribers) {
    const subscriberId = s?.subscriberId ?? null;
    const iccid =
      s?.imsiList?.[0]?.iccid ??
      s?.sim?.iccid ??
      null;

    // From the listSubscriber block (present in your JSON)
    const activationDate = s?.activationDate ?? null;
    const lastUsageDate = s?.lastUsageDate ?? null;

    // Defaults for template/usage details (filled by extra calls if available)
    let prepaidpackagetemplatename = null;
    let prepaidpackagetemplateid = null;
    let tsactivationutc = null;
    let tsexpirationutc = null;
    let pckdatabyte = null;
    let useddatabyte = null;
    let subscriberUsageOverPeriod = null;

    // 2) Package info (adjust op name if your guide differs)
    if (subscriberId) {
      try {
        const pkgResp = await callOCS({
          listSubscriberPrepaidPackage: { subscriberId }
        });
        const pkg =
          (pickArray(pkgResp?.listSubscriberPrepaidPackage) || pickArray(pkgResp))[0] ||
          null;

        if (pkg) {
          prepaidpackagetemplatename =
            pkg.prepaidPackageTemplateName ?? pkg.templateName ?? null;
          prepaidpackagetemplateid =
            pkg.prepaidPackageTemplateId ?? pkg.templateId ?? null;
          tsactivationutc = pkg.tsActivationUtc ?? pkg.tsactivationutc ?? null;
          tsexpirationutc = pkg.tsExpirationUtc ?? pkg.tsexpirationutc ?? null;
          pckdatabyte = pkg.pckDataByte ?? pkg.packageDataByte ?? null;
          useddatabyte = pkg.usedDataByte ?? pkg.useddatabyte ?? null;
        }
      } catch (_) {
        // ignore per-subscriber failure
      }

      // 3) Usage over period (adjust op/keys if needed)
      try {
        const usageResp = await callOCS({
          subscriberUsageOverPeriod: { subscriberId, fromDate, toDate }
        });
        const usage =
          pickArray(usageResp?.subscriberUsageOverPeriod) || pickArray(usageResp) || null;
        subscriberUsageOverPeriod = usage;
      } catch (_) {
        // ignore
      }
    }

    rows.push({
      iccid,
      lastUsageDate,
      prepaidpackagetemplatename,
      activationDate,
      tsactivationutc,
      tsexpirationutc,
      prepaidpackagetemplateid,
      pckdatabyte,
      useddatabyte,
      subscriberUsageOverPeriod
    });
  }

  return rows;
}
