"use client";

import { useEffect, useMemo, useState } from "react";

// bytes → GB
function bytesToGB(b) {
  if (b == null || isNaN(b)) return "";
  return (Number(b) / (1024 ** 3)).toFixed(2);
}

// SAFE fetch: always returns {ok:boolean, data:any, error?:string}
async function safeFetchJSON(input, init) {
  const res = await fetch(input, init);
  const text = await res.text();                // never throws
  let json = null;
  try { json = text ? JSON.parse(text) : null; } catch { /* leave null */ }
  if (!res.ok) {
    return { ok: false, error: `HTTP ${res.status} ${res.statusText}${text ? " :: " + text.slice(0,300) : ""}` };
  }
  // If server gave non-JSON / empty body, still return something
  if (!json) return { ok: true, data: { _empty: true, _raw: text || "" } };
  return { ok: true, data: json };
}

const DEFAULT_ACCOUNT_ID = process.env.NEXT_PUBLIC_DEFAULT_ACCOUNT_ID || "";

export default function Page() {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(false);
  const [q, setQ] = useState("");
  const [error, setError] = useState("");
  const [accountId, setAccountId] = useState(String(DEFAULT_ACCOUNT_ID));

  const columns = [
    "ICCID","lastUsageDate","prepaidpackagetemplatename","activationDate",
    "tsactivationutc","tsexpirationutc","prepaidpackagetemplateid",
    "pckdatabyte","useddatabyte","pckdata(GB)","used(GB)",
    // extra columns from listSubscriber so you always see data:
    "IMSI","phoneNumber","simStatus","prepaid","balance","account","reseller","lastMcc","lastMnc"
  ];

  const filtered = useMemo(() => {
    if (!q.trim()) return rows;
    const n = q.toLowerCase();
    return rows.filter(r => Object.values(r).some(v => String(v ?? "").toLowerCase().includes(n)));
  }, [rows, q]);

  async function load() {
    setError("");
    setLoading(true);
    try {
      const url = new URL("/api/fetch-data", window.location.origin);
      if (accountId && accountId.trim()) url.searchParams.set("accountId", accountId.trim());

      const res = await safeFetchJSON(url.toString(), { cache: "no-store" });
      if (!res.ok) throw new Error(res.error || "Fetch failed");

      // our API returns { ok, data } – handle also _raw/empty fallbacks
      const payload = res.data;
      if (payload?.ok === false) throw new Error(payload?.error || "API error");
      const table = Array.isArray(payload?.data) ? payload.data : [];
      setRows(table);
      if (!table.length && payload && !Array.isArray(payload.data)) {
        setError("API returned no table rows. Debug payload: " + JSON.stringify(payload).slice(0,500));
      }
    } catch (e) {
      setRows([]);
      setError(e.message || "Failed");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []);

  function exportCSV() {
    const headers = [...columns];
    const lines = [headers.join(",")];
    filtered.forEach(r => {
      lines.push([
        r.iccid ?? "", r.lastUsageDate ?? "", r.prepaidpackagetemplatename ?? "", r.activationDate ?? "",
        r.tsactivationutc ?? "", r.tsexpirationutc ?? "", r.prepaidpackagetemplateid ?? "",
        r.pckdatabyte ?? "", r.useddatabyte ?? "", bytesToGB(r.pckdatabyte), bytesToGB(r.useddatabyte),
        r.imsi ?? "", r.phoneNumber ?? "", r.simStatus ?? "", String(r.prepaid ?? ""),
        r.balance ?? "", r.account ?? "", r.reseller ?? "", r.lastMcc ?? "", r.lastMnc ?? ""
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

  return (
    <main style={{ padding: 24, maxWidth: 1600, margin: "0 auto" }}>
      <header style={{ display: "grid", gridTemplateColumns: "auto auto auto 1fr 260px", gap: 12, alignItems: "center", marginBottom: 12 }}>
        <h1 style={{ margin: 0, fontSize: 26 }}>Teltrip Dashboard</h1>
        <input
          placeholder="Account ID (e.g. 3771)"
          value={accountId}
          onChange={e => setAccountId(e.target.value)}
          style={{ padding: "10px 12px", borderRadius: 10, border: "1px solid #2a3353", background: "#0e1430", color: "#e9edf5", width: 180 }}
        />
        <button
          onClick={load}
          disabled={loading}
          style={{ padding: "8px 14px", borderRadius: 10, border: "1px solid #2a3353", background: "#151a2e", color: "#e9edf5", cursor: "pointer" }}
        >
          {loading ? "Refreshing…" : "Load"}
        </button>
        <div />
        <div style={{ display: "flex", gap: 8, justifySelf: "end" }}>
          <button onClick={exportCSV} style={{ padding: "8px 14px", borderRadius: 10, border: "1px solid #2a3353", background: "#151a2e", color: "#e9edf5", cursor: "pointer" }}>
            Export CSV
          </button>
          <input
            placeholder="Search…"
            value={q}
            onChange={e => setQ(e.target.value)}
            style={{ padding: "10px 12px", borderRadius: 10, border: "1px solid #2a3353", background: "#0e1430", color: "#e9edf5", width: 260 }}
          />
        </div>
      </header>

      {error && (
        <div style={{ background: "#3a0f12", border: "1px solid #7a1c22", color: "#ffd7d7", padding: "10px 12px", borderRadius: 10, marginBottom: 12, whiteSpace: "pre-wrap", fontSize: 12 }}>
          {error}
        </div>
      )}

      <div
        style={{
          display: "grid",
          gridTemplateColumns:
            "1.6fr 1.4fr 2fr 1.4fr 1.6fr 1.6fr 1.8fr 1.2fr 1.2fr 1.2fr 1.2fr 1.6fr 1.4fr 1.2fr 0.9fr 1fr 1.2fr 0.8fr 0.8fr",
          gap: 8, fontSize: 13, border: "1px solid #1b2340", borderRadius: 14, overflow: "hidden"
        }}
      >
        {columns.map((h) => (
          <div key={h} style={{ padding: "10px 12px", background: "#0e1430", borderBottom: "1px solid #1b2340", fontWeight: 600 }}>
            {h}
          </div>
        ))}

        {filtered.map((r, i) => {
          const baseStyle = { padding: "10px 12px", borderBottom: "1px solid #111730", background: i % 2 ? "#0b1024" : "#0b1020", wordBreak: "break-all" };
          return (
            <>
              <div style={baseStyle}>{r.iccid ?? ""}</div>
              <div style={baseStyle}>{r.lastUsageDate ?? ""}</div>
              <div style={baseStyle}>{r.prepaidpackagetemplatename ?? ""}</div>
              <div style={baseStyle}>{r.activationDate ?? ""}</div>
              <div style={baseStyle}>{r.tsactivationutc ?? ""}</div>
              <div style={baseStyle}>{r.tsexpirationutc ?? ""}</div>
              <div style={baseStyle}>{r.prepaidpackagetemplateid ?? ""}</div>
              <div style={baseStyle}>{r.pckdatabyte ?? ""}</div>
              <div style={baseStyle}>{r.useddatabyte ?? ""}</div>
              <div style={baseStyle}>{bytesToGB(r.pckdatabyte)}</div>
              <div style={baseStyle}>{bytesToGB(r.useddatabyte)}</div>
              <div style={baseStyle}>{r.imsi ?? ""}</div>
              <div style={baseStyle}>{r.phoneNumber ?? ""}</div>
              <div style={baseStyle}>{r.simStatus ?? ""}</div>
              <div style={baseStyle}>{String(r.prepaid ?? "")}</div>
              <div style={baseStyle}>{r.balance ?? ""}</div>
              <div style={baseStyle}>{r.account ?? ""}</div>
              <div style={baseStyle}>{r.reseller ?? ""}</div>
              <div style={baseStyle}>{r.lastMcc ?? ""}</div>
              <div style={baseStyle}>{r.lastMnc ?? ""}</div>
            </>
          );
        })}
      </div>

      <p style={{ opacity: 0.7, marginTop: 10, fontSize: 12 }}>
        * If columns stay empty, your tenant uses different package/usage ops. Paste those from <code>alldatanew9.py</code> and I’ll wire them in.
      </p>
    </main>
  );
}
