const BASE = process.env.OCS_BASE_URL;
const TOKEN = process.env.OCS_TOKEN;
const DEFAULT_ACCOUNT_ID = parseInt(process.env.OCS_ACCOUNT_ID || "0", 10);

async function callOCS(payload) {
  const url = `${BASE}?token=${encodeURIComponent(TOKEN)}`;
  const r = await fetch(url,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(payload),cache:"no-store"});
  return await r.json();
}

export async function fetchAllData(accountIdParam){
  const ACCOUNT_ID = parseInt(accountIdParam || DEFAULT_ACCOUNT_ID || "0",10);
  const subsResp = await callOCS({ listSubscriber:{ accountId:ACCOUNT_ID }});
  return subsResp;
}