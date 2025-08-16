"use client";

import { useEffect, useMemo, useState } from "react";
import * as XLSX from "xlsx";

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

  // Columns (includes one-time Subscriber Cost from package; totals keep reseller only)
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

  // Export helpers
  function exportCSV() {
    const headers = [...columns];
    const lines = [headers.join(",")];
    filtered.forEach(r => {
      lines.push([
        r.iccid ?? "", r.imsi ?? "", r.phoneNumber ?? "", r.subscriberStatus ?? "", r.simStatus ?? "", String(r.esim ?? ""),
        r.activationCode ?? "", fmtDT(r.activationDate), fmtDT(r.lastUsageDate), String(r.prepaid ?? ""), r.balance ?? "",
        r.account ?? "", r.reseller ?? "", r.lastMcc ?? "", r.lastMnc ?? "",
        r.prepaidpackagetemplatename ?? "", r.prepaidpackagetemplateid ?? "", fmtDT(r.tsactivationutc), fmtDT(r.tsexpirationutc),
        r.pckdatabyte ?? "", r.useddatabyte ?? "", bytesToGB(r.pckdatabyte), bytesToGB(r.useddatabyte),
        money(r.subscriberOneTimeCost), bytesToGB(r.totalBytesSinceJun1), money(r.resellerCostSinceJun1)
      ].map(x => `"${String(x).replace(/"/g, '""')}"`).join(","));
    });
    const blob = new Blob([lines.join("\n")], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `teltrip_dashboard_${new Date().toISOString().slice(0,10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  function exportExcel() {
    // build a flat array of objects for XLSX
    const data = filtered.map(r => ({
      ICCID: r.iccid ?? "",
      IMSI: r.imsi ?? "",
      phoneNumber: r.phoneNumber ?? "",
      subscriberStatus: r.subscriberStatus ?? "",
      simStatus: r.simStatus ?? "",
      esim: String(r.esim ?? ""),
      activationCode: r.activationCode ?? "",
      activationDate: fmtDT(r.activationDate),
      lastUsageDate: fmtDT(r.lastUsageDate),
      prepaid: String(r.prepaid ?? ""),
      balance: r.balance ?? "",
      account: r.account ?? "",
      reseller: r.reseller ?? "",
      lastMcc: r.lastMcc ?? "",
      lastMnc: r.lastMnc ?? "",
      prepaidpackagetemplatename: r.prepaidpackagetemplatename ?? "",
      prepaidpackagetemplateid: r.prepaidpackagetemplateid ?? "",
      tsactivationutc: fmtDT(r.tsactivationutc),
      tsexpirationutc: fmtDT(r.tsexpirationutc),
      pckdatabyte: r.pckdatabyte ?? "",
      useddatabyte: r.useddatabyte ?? "",
      "pckdata(GB)": bytesToGB(r.pckdatabyte),
      "used(GB)": bytesToGB(r.useddatabyte),
      subscriberOneTimeCost: money(r.subscriberOneTimeCost),
      "usageSinceJun1(GB)": bytesToGB(r.totalBytesSinceJun1),
      resellerCostSinceJun1: money(r.resellerCostSinceJun1)
    }));
    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Teltrip");
    XLSX.writeFile(wb, `teltrip_dashboard_${new Date().toISOString().slice(0,10)}.xlsx`);
  }

  const Header = ({children}) => (
    <div style={{ padding:"10px 12px", background:"#eaf6c9", borderBottom:"1px solid #cbd5a7", fontWeight:600, color:"#000" }}>{children}</div>
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
    <main style={{ padding: 24, maxWidth: 1800, margin: "0 auto" }}>
      {/* Centered logo (place your image at /public/logo.png) */}
      <div style={{ display:"flex", justifyContent:"center", marginBottom: 12 }}>
        <img src="/logo.png" alt="Teltrip" style={{ height: 64 }} />
      </div>

      <header style={{ display:"grid", gridTemplateColumns:"auto auto auto 1fr 360px", gap:12, alignItems:"center", marginBottom:14 }}>
        <h1 style={{ margin:0, color:"#000" }}>Teltrip Dashboard</h1>
        <input
          value={accountId}
          onChange={e=>setAccountId(e.target.value)}
          placeholder="Account ID"
          style={{ padding:"10px 12px", borderRadius:10, border:"1px solid #cbd5a7", background:"#fff", color:"#000", width:180 }}
        />
        <button
          onClick={load}
          disabled={loading}
          style={{ padding:"8px 14px", borderRadius:10, border:"1px solid #cbd5a7", background:"#cfeaa1", color:"#000", cursor:"pointer" }}
        >
          {loading ? "Loading…" : "Load"}
        </button>
        <div />
        <div style={{ display:"flex", gap:8, justifySelf:"end" }}>
          <button
            onClick={exportCSV}
            style={{ padding:"8px 14px", borderRadius:10, border:"1px solid #cbd5a7", background:"#e6f3c2", color:"#000", cursor:"pointer" }}
          >
            Export CSV
          </button>
          <button
            onClick={exportExcel}
            style={{ padding:"8px 14px", borderRadius:10, border:"1px solid #cbd5a7", background:"#bfe080", color:"#000", cursor:"pointer" }}
          >
            Export Excel
          </button>
          <input
            value={q}
            onChange={e=>setQ(e.target.value)}
            placeholder="Search…"
            style={{ padding:"10px 12px", borderRadius:10, border:"1px solid #cbd5a7", background:"#fff", color:"#000", width:260 }}
          />
        </div>
      </header>

      {err && (
        <div style={{ background:"#ffefef", border:"1px solid #e5a5a5", color:"#900", padding:"10px 12px", borderRadius:10, marginBottom:12, whiteSpace:"pre-wrap", fontSize:12 }}>
          {err}
        </div>
      )}

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
        Light theme, centered logo. Export to CSV/Excel. Usage & reseller cost aggregated from <b>2025-06-01</b> to today.
      </p>
    </main>
  );
}
