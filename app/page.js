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

  // Columns (one-time Subscriber Cost from package; totals keep reseller only)
  const columns = [
    "ICCID","IMSI","phoneNumber","subscriberStatus","simStatus","esim","activationCode",
    "activationDate","lastUsageDate","prepaid","balance","account","reseller","lastMcc","lastMnc",
    "prepaidpackagetemplatename","prepaidpackagetemplateid","tsactivationutc","tsexpirationutc","pckdatabyte","useddatabyte","pckdata(GB)","used(GB)",
    "subscriberOneTimeCost","usageSinceJun1(GB)","resellerCostSinceJun1"
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
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => { load(); }, []);

  const Header = ({children}) => (
    <div style={{ padding:"10px 12px", background:"#e5edc2", borderBottom:"1px solid #cbd5a7", fontWeight:600, color:"#000" }}>{children}</div>
  );
  const Cell = ({children, i}) => (
    <div style={{
      padding:"10px 12px",
      borderBottom:"1px solid #cbd5a7",
      background: i%2? "#ffffff":"#f6fadf",
      wordBreak:"break-all",
      color:"#000"
    }}>{children}</div>
  );

  return (
    <main style={{ padding: 24, maxWidth: 1800, margin: "0 auto", background:"#eff4db", color:"#000" }}>
      {/* Logo (optional; place /public/logo.png) */}
      <div style={{ display:"flex", justifyContent:"center", marginBottom: 12 }}>
        <img src="/logo.png" alt="Teltrip" style={{ height: 56 }} />
      </div>

      <header style={{ display:"grid", gridTemplateColumns:"auto auto auto 1fr 260px", gap:12, alignItems:"center", marginBottom:14 }}>
        <h1 style={{ margin:0, color:"#000" }}>Teltrip Dashboard</h1>
        <input value={accountId} onChange={e=>setAccountId(e.target.value)} placeholder="Account ID"
               style={{ padding:"10px 12px", borderRadius:10, border:"1px solid #cbd5a7", background:"#fff", color:"#000", width:180 }}/>
        <button onClick={load} disabled={loading}
                style={{ padding:"8px 14px", borderRadius:10, border:"1px solid #cbd5a7", background:"#d9e8a6", color:"#000", cursor:"pointer" }}>
          {loading ? "Loading…" : "Load"}
        </button>
        <div/>
        <input value={q} onChange={e=>setQ(e.target.value)} placeholder="Search…"
               style={{ padding:"10px 12px", borderRadius:10, border:"1px solid #cbd5a7", background:"#fff", color:"#000", width:260 }}/>
      </header>

      {err && <div style={{ background:"#ffefef", border:"1px solid #e5a5a5", color:"#900", padding:"10px 12px", borderRadius:10, marginBottom:12, whiteSpace:"pre-wrap", fontSize:12 }}>{err}</div>}

      <div style={{ overflowX:"auto", border:"1px solid #cbd5a7", borderRadius:14 }}>
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

              {/* costs/usage */}
              <Cell i={i}>{money(r.subscriberOneTimeCost)}</Cell>
              <Cell i={i}>{bytesToGB(r.totalBytesSinceJun1)}</Cell>
              <Cell i={i}>{money(r.resellerCostSinceJun1)}</Cell>
            </>
          ))}
        </div>
      </div>

      <p style={{ opacity:.7, marginTop:10, fontSize:12, color:"#000" }}>
        Subscriber Cost = one-time price from the active package. Usage & reseller cost aggregated from <b>2025-06-01</b> to today (weekly API windows).
      </p>
    </main>
  );
}
