"use client";

import { useEffect, useMemo, useState } from "react";

function bytesToGB(b) {
  if (b == null || isNaN(b)) return "";
  return (Number(b) / (1024 ** 3)).toFixed(2);
}

const DEFAULT_ACCOUNT_ID = process.env.NEXT_PUBLIC_DEFAULT_ACCOUNT_ID || "";

export default function Page() {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(false);
  const [q, setQ] = useState("");
  const [error, setError] = useState("");
  const [accountId, setAccountId] = useState(String(DEFAULT_ACCOUNT_ID));

  const columns = [
    // original columns
    "ICCID",
    "lastUsageDate",
    "prepaidpackagetemplatename",
    "activationDate",
    "tsactivationutc",
    "tsexpirationutc",
    "prepaidpackagetemplateid",
    "pckdatabyte",
    "useddatabyte",
    "pckdata(GB)",
    "used(GB)",
    // new columns that we can fill from listSubscriber
    "IMSI",
    "phoneNumber",
    "simStatus",
    "prepaid",
    "balance",
    "account",
    "reseller",
    "lastMcc",
    "lastMnc"
  ];

  const filtered = useMemo(() => {
    if (!q.trim()) return rows;
    const needle = q.toLowerCase();
    return rows.filter(r =>
      Object.values(r).some(v => String(v ?? "").toLowerCase().includes(needle))
    );
  }, [rows, q]);

  async function load() {
    setError("");
    setLoading(true);
    try {
      const url = new URL("/api/fetch-data", window.location.origin);
      if (accountId && accountId.trim()) url.searchParams.set("accountId", accountId.trim());
      const r = await fetch(url, { cache: "no-store" });
      const json = await r.json();
      if (!json.ok) throw new Error(json.error || "Fetch failed");
      setRows(json.data || []);
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
        r.iccid ?? "",
        r.lastUsageDate ?? "",
        r.prepaidpackagetemplatename ?? "",
        r.activationDate ?? "",
        r.tsactivationutc ?? "",
        r.tsexpirationutc ?? "",
        r.prepaidpackagetemplateid ?? "",
        r.pckdatabyte ?? "",
        r.useddatabyte ?? "",
        bytesToGB(r.pckdatabyte),
        bytesToGB(r.useddatabyte),
        r.imsi ?? "",
        r.phoneNumber ?? "",
        r.simStatus ?? "",
        r.prepaid ?? "",
        r.balance ?? "",
        r.account ?? "",
        r.reseller ?? "",
        r.lastMcc ?? "",
        r.lastMnc ?? ""
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
          style={{
            padding: "8px 14px",
            borderRadius: 10,
            border: "1px solid #2a3353",
            background: "#151a2e",
            color: "#e9edf5",
            cursor: "pointer"
          }}
        >
          {loading ? "Refreshing…" : "Load"}
        </button>

        <div />

        <div style={{ display: "flex", gap: 8, justifySelf: "end" }}>
          <button
            onClick={exportCSV}
            style={{
              padding: "8px 14px",
              borderRadius: 10,
              border: "1px solid #2a3353",
              background: "#151a2e",
              color: "#e9edf5",
              cursor: "pointer"
            }}
          >
            Export CSV
          </button>
          <input
            placeholder="Search…"
            value={q}
            onChange={e => setQ(e.target.value)}
            style={{
              padding: "10px 12px",
              borderRadius: 10,
              border: "1px solid #2a3353",
              background: "#0e1430",
              color: "#e9edf5",
              width: 260
            }}
          />
        </div>
      </header>

      {error && (
        <div style={{
          background: "#3a0f12",
          border: "1px solid #7a1c22",
          color: "#ffd7d7",
          padding: "10px 12px",
          borderRadius: 10,
          marginBottom: 12,
          whiteSpace: "pre-wrap",
          fontSize: 12
        }}>
          {error}
        </div>
      )}

      <div
        style={{
          display: "grid",
          gridTemplateColumns:
            "1.6fr 1.4fr 2fr 1.4fr 1.6fr 1.6fr 1.8fr 1.2fr 1.2fr 1.2fr 1.2fr 1.6fr 1.4fr 1.2fr 0.9fr 1fr 1.2fr 0.8fr 0.8fr",
          gap: 8,
          fontSize: 13,
          border: "1px solid #1b2340",
          borderRadius: 14,
          overflow: "hidden"
        }}
      >
        {columns.map((h) => (
          <div
            key={h}
            style={{
              padding: "10px 12px",
              background: "#0e1430",
              borderBottom: "1px solid #1b2340",
              fontWeight: 600
            }}
          >
            {h}
          </div>
        ))}

        {filtered.map((r, i) => {
          const baseStyle = {
            padding: "10px 12px",
            borderBottom: "1px solid #111730",
            background: i % 2 ? "#0b1024" : "#0b1020",
            wordBreak: "break-all"
          };
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
        * Usage window: last {process.env.NEXT_PUBLIC_USAGE_DAYS || 30} days.  
        Package/usage fields fill if your tenant’s endpoints match the best-effort list;  
        the new columns are sourced directly from <code>listSubscriber.subscriberList</code>.
      </p>
    </main>
  );
}
