"use client";

import { useEffect, useMemo, useState } from "react";

// safe fetch: never crashes on non-JSON/empty
async function safeFetch(url) {
  const res = await fetch(url, { cache: "no-store" });
  const text = await res.text();
  let json = null; try { json = text ? JSON.parse(text) : null; } catch {}
  if (!res.ok) throw new Error(`HTTP ${res.status} ${res.statusText}${text ? " :: " + text.slice(0,300) : ""}`);
  return json;
}

// bytes → GB (kept for when package fields start filling)
function bytesToGB(b) {
  if (b == null || isNaN(b)) return "";
  return (Number(b) / (1024 ** 3)).toFixed(2);
}

export default function Page() {
  const [accountId, setAccountId] = useState("3771"); // set your default
  const [rows, setRows] = useState([]);
  const [q, setQ] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  // Columns to show (order = display order)
  const columns = [
    // subscriberList fields (always available from your JSON)
    "ICCID","IMSI","phoneNumber","subscriberStatus","simStatus","esim","smdpServer","activationCode",
    "activationDate","lastUsageDate","prepaid","balance","account","reseller","lastMcc","lastMnc",
    // placeholders for enrichment (will be blank until we wire package/usage ops)
    "prepaidpackagetemplatename","prepaidpackagetemplateid","tsactivationutc","tsexpirationutc","pckdatabyte","useddatabyte","pckdata(GB)","used(GB)"
  ];

  // build table with search
  const filtered = useMemo(() => {
    const n = q.trim().toLowerCase();
    if (!n) return rows;
    return rows.filter(r => Object.values(r).some(v => String(v ?? "").toLowerCase().includes(n)));
  }, [rows, q]);

  async function load() {
    setError(""); setLoading(true);
    try {
      const url = new URL("/api/fetch-data", window.location.origin);
      if (accountId) url.searchParams.set("accountId", accountId.trim());
      const payload = await safeFetch(url.toString());
      if (payload?.ok === false) throw new Error(payload.error || "API error");
      const data = Array.isArray(payload?.data) ? payload.data : [];
      setRows(data);
      if (!Array.isArray(payload?.data)) setError("No data array. Check env/token/accountId.");
    } catch (e) {
      setRows([]); setError(e.message || "Failed");
    } finally { setLoading(false); }
  }

  useEffect(() => { load(); }, []);

  // width per column to enable horizontal scroll
  const colWidth = 160; // px
  const minWidth = columns.length * colWidth;

  return (
    <main style={{ padding: 24, maxWidth: 1800, margin: "0 auto" }}>
      <header style={{ display: "grid", gridTemplateColumns: "auto auto auto 1fr 260px", gap: 12, alignItems: "center", marginBottom: 14 }}>
        <h1 style={{ margin: 0 }}>Teltrip Dashboard</h1>

        <input
          placeholder="Account ID (e.g. 3771)"
          value={accountId}
          onChange={e=>setAccountId(e.target.value)}
          style={{ padding:"10px 12px", borderRadius:10, border:"1px solid #2a3353", background:"#0e1430", color:"#e9edf5", width:180 }}
        />

        <button
          onClick={load}
          disabled={loading}
          style={{ padding:"8px 14px", borderRadius:10, border:"1px solid #2a3353", background:"#151a2e", color:"#e9edf5", cursor:"pointer" }}
        >
          {loading ? "Loading…" : "Load"}
        </button>

        <div />

        <input
          placeholder="Search…"
          value={q}
          onChange={e=>setQ(e.target.value)}
          style={{ padding:"10px 12px", borderRadius:10, border:"1px solid #2a3353", background:"#0e1430", color:"#e9edf5", width:260 }}
        />
      </header>

      {error && (
        <div style={{ background:"#3a0f12", border:"1px solid #7a1c22", color:"#ffd7d7", padding:"10px 12px", borderRadius:10, marginBottom:12, whiteSpace:"pre-wrap", fontSize:12 }}>
          {error}
        </div>
      )}

      {/* SCROLLABLE WRAPPER */}
      <div style={{ overflowX: "auto", border:"1px solid #1b2340", borderRadius:14 }}>
        <div
          style={{
            display:"grid",
            gridTemplateColumns: `repeat(${columns.length}, ${colWidth}px)`,
            gap: 8,
            fontSize: 13,
            minWidth
          }}
        >
          {/* headers */}
          {columns.map(h=>(
            <div key={h} style={{ padding:"10px 12px", background:"#0e1430", borderBottom:"1px solid #1b2340", fontWeight:600 }}>
              {h}
            </div>
          ))}

          {/* rows */}
          {filtered.map((r, i) => {
            const base = { padding:"10px 12px", borderBottom:"1px solid #111730", background: i%2? "#0b1024":"#0b1020", wordBreak:"break-all" };
            return (
              <>
                {/* map each visible column to the correct field */}
                <div style={base}>{r.iccid ?? ""}</div>
                <div style={base}>{r.imsi ?? ""}</div>
                <div style={base}>{r.phoneNumber ?? ""}</div>
                <div style={base}>{r.subscriberStatus ?? ""}</div>
                <div style={base}>{r.simStatus ?? ""}</div>
                <div style={base}>{String(r.esim ?? "")}</div>
                <div style={base}>{r.smdpServer ?? ""}</div>
                <div style={base}>{r.activationCode ?? ""}</div>
                <div style={base}>{r.activationDate ?? ""}</div>
                <div style={base}>{r.lastUsageDate ?? ""}</div>
                <div style={base}>{String(r.prepaid ?? "")}</div>
                <div style={base}>{r.balance ?? ""}</div>
                <div style={base}>{r.account ?? ""}</div>
                <div style={base}>{r.reseller ?? ""}</div>
                <div style={base}>{r.lastMcc ?? ""}</div>
                <div style={base}>{r.lastMnc ?? ""}</div>

                {/* enrichment placeholders */}
                <div style={base}>{r.prepaidpackagetemplatename ?? ""}</div>
                <div style={base}>{r.prepaidpackagetemplateid ?? ""}</div>
                <div style={base}>{r.tsactivationutc ?? ""}</div>
                <div style={base}>{r.tsexpirationutc ?? ""}</div>
                <div style={base}>{r.pckdatabyte ?? ""}</div>
                <div style={base}>{r.useddatabyte ?? ""}</div>
                <div style={base}>{bytesToGB(r.pckdatabyte)}</div>
                <div style={base}>{bytesToGB(r.useddatabyte)}</div>
              </>
            );
          })}
        </div>
      </div>

      <p style={{ opacity:.7, marginTop:10, fontSize:12 }}>
        Tip: scroll sideways to see all columns.
      </p>
    </main>
  );
}
