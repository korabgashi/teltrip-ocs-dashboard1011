"use client";

import { useEffect, useMemo, useState } from "react";

// safe fetch
async function safeFetch(url) {
  const res = await fetch(url, { cache: "no-store" });
  const txt = await res.text();
  let json = null; try { json = txt ? JSON.parse(txt) : null; } catch {}
  if (!res.ok) throw new Error(`HTTP ${res.status} ${res.statusText}${txt ? " :: " + txt.slice(0,300) : ""}`);
  return json ?? {};
}
const bytesToGB = (b) => (b == null || isNaN(b)) ? "" : (Number(b) / (1024 ** 3)).toFixed(2);
const money = (n) => (n == null || isNaN(n)) ? "" : Number(n).toFixed(2);
const fmtDT = (s) => typeof s === "string" ? s.replace("T", " ") : s ?? "";

export default function Page() {
  const [accountId, setAccountId] = useState("3771");
  const [rows, setRows] = useState([]);
  const [q, setQ] = useState("");
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");

  // Columns (includes your new totals + resellerCost + no “T” in displayed dates)
  const columns = [
    "ICCID","IMSI","phoneNumber","subscriberStatus","simStatus","esim","activationCode",
    "activationDate","lastUsageDate","prepaid","balance","account","reseller","lastMcc","lastMnc",
    "prepaidpackagetemplatename","prepaidpackagetemplateid","tsactivationutc","tsexpirationutc","pckdatabyte","useddatabyte","pckdata(GB)","used(GB)",
    "usageSinceJun1(GB)","subscriberCostSinceJun1","resellerCostSinceJun1"
  ];
  const colW = 170;
  const minW = columns.length * colW;

  const filtered = useMemo(() => {
    const n = q.trim().toLowerCase();
    if (!n) return rows;
    return rows.filter(r => Object.values(r).some(v => String(v ?? "").toLowerCase().includes(n)));
  }, [rows, q]);

  async function load() {
    setErr(""); setLoading(true);
    try {
      const url = new URL("/api/fetch-data", window.location.origin);
      if (accountId) url.searchParams.set("accountId", accountId.trim());
      const payload = await safeFetch(url.toString());
      if (payload?.ok === false) throw new Error(payload.error || "API error");
      setRows(Array.isArray(payload?.data) ? payload.data : []);
      if (!Array.isArray(payload?.data)) setErr("No data array. Check env/token/accountId.");
    } catch (e) {
      setRows([]); setErr(e.message || "Failed");
    } finally { setLoading(false); }
  }
  useEffect(() => { load(); }, []);

  const Header = ({children}) => (
    <div style={{ padding:"10px 12px", background:"#0e1430", borderBottom:"1px solid #1b2340", fontWeight:600 }}>{children}</div>
  );
  const Cell = ({children, i}) => (
    <div style={{
      padding:"10px 12px",
      borderBottom:"1px solid #111730",
      background: i%2? "#0b1024":"#0b1020",
      wordBreak:"break-all"
    }}>{children}</div>
  );

  return (
    <main style={{ padding: 24, maxWidth: 1800, margin: "0 auto" }}>
      <header style={{ display:"grid", gridTemplateColumns:"auto auto auto 1fr 260px", gap:12, alignItems:"center", marginBottom:14 }}>
        <h1 style={{ margin:0 }}>Teltrip Dashboard</h1>
        <input value={accountId} onChange={e=>setAccountId(e.target.value)} placeholder="Account ID"
               style={{ padding:"10px 12px", borderRadius:10, border:"1px solid #2a3353", background:"#0e1430", color:"#e9edf5", width:180 }}/>
        <button onClick={load} disabled={loading}
                style={{ padding:"8px 14px", borderRadius:10, border:"1px solid #2a3353", background:"#151a2e", color:"#e9edf5", cursor:"pointer" }}>
          {loading ? "Loading…" : "Load"}
        </button>
        <div/>
        <input value={q} onChange={e=>setQ(e.target.value)} placeholder="Search…"
               style={{ padding:"10px 12px", borderRadius:10, border:"1px solid #2a3353", background:"#0e1430", color:"#e9edf5", width:260 }}/>
      </header>

      {err && <div style={{ background:"#3a0f12", border:"1px solid #7a1c22", color:"#ffd7d7", padding:"10px 12px", borderRadius:10, marginBottom:12, whiteSpace:"pre-wrap", fontSize:12 }}>{err}</div>}

      <div style={{ overflowX:"auto", border:"1px solid #1b2340", borderRadius:14 }}>
        <div style={{ display:"grid", gridTemplateColumns:`repeat(${columns.length}, ${colW}px)`, gap:8, minWidth:minW, fontSize:13 }}>
          {columns.map((h) => <Header key={h}>{h}</Header>)}

          {filtered.map((r, i) => (
            <>
              {/* core */}
              <Cell i={i}>{r.iccid ?? ""}</Cell>
              <Cell i={i}>{r.imsi ?? ""}</Cell>
              <Cell i={i}>{r.phoneNumber ?? ""}</Cell>
              <Cell i={i}>{r.subscriberStatus ?? ""}</Cell>
              <Cell i={i}>{r.simStatus ?? ""}</Cell>
              <Cell i={i}>{String(r.esim ?? "")}</Cell>
              <Cell i={i}>{r.activationCode ?? ""}</Cell>
              <Cell i={i}>{fmtDT(r.activationDate)}</Cell>
              <Cell i={i}>{fmtDT(r.lastUsageDate)}</Cell>
              <Cell i={i}>{String(r.prepaid ?? "")}</Cell>
              <Cell i={i}>{r.balance ?? ""}</Cell>
              <Cell i={i}>{r.account ?? ""}</Cell>
              <Cell i={i}>{r.reseller ?? ""}</Cell>
              <Cell i={i}>{r.lastMcc ?? ""}</Cell>
              <Cell i={i}>{r.lastMnc ?? ""}</Cell>

              {/* package */}
              <Cell i={i}>{r.prepaidpackagetemplatename ?? ""}</Cell>
              <Cell i={i}>{r.prepaidpackagetemplateid ?? ""}</Cell>
              <Cell i={i}>{fmtDT(r.tsactivationutc)}</Cell>
              <Cell i={i}>{fmtDT(r.tsexpirationutc)}</Cell>
              <Cell i={i}>{r.pckdatabyte ?? ""}</Cell>
              <Cell i={i}>{r.useddatabyte ?? ""}</Cell>
              <Cell i={i}>{bytesToGB(r.pckdatabyte)}</Cell>
              <Cell i={i}>{bytesToGB(r.useddatabyte)}</Cell>

              {/* totals since 2025-06-01 */}
              <Cell i={i}>{bytesToGB(r.totalBytesSinceJun1)}</Cell>
              <Cell i={i}>{money(r.subscriberCostSinceJun1)}</Cell>
              <Cell i={i}>{money(r.resellerCostSinceJun1)}</Cell>
            </>
          ))}
        </div>
      </div>

      <p style={{ opacity:.7, marginTop:10, fontSize:12 }}>
        Usage & costs aggregated from <b>2025-06-01</b> to today (one-week API windows). Dates shown without “T”.
      </p>
    </main>
  );
}
