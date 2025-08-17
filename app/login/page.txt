"use client";

import { useState } from "react";

export default function LoginPage() {
  const [user, setUser] = useState("");
  const [pass, setPass] = useState("");
  const [err, setErr] = useState("");
  const [loading, setLoading] = useState(false);

  async function onSubmit(e) {
    e.preventDefault();
    setErr(""); setLoading(true);
    try {
      const r = await fetch("/api/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ user, pass }),
      });
      const j = await r.json().catch(()=>({}));
      if (!r.ok || j?.ok === false) throw new Error(j?.error || `HTTP ${r.status}`);
      const next = new URLSearchParams(window.location.search).get("next") || "/";
      window.location.href = next;
    } catch (e) {
      setErr(e.message || "Login failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main style={{ minHeight:"100dvh", display:"grid", placeItems:"center", background:"#eff4db", color:"#000", fontFamily:"system-ui" }}>
      <form onSubmit={onSubmit} style={{ width:360, background:"#fff", border:"1px solid #cbd5a7", borderRadius:12, padding:20, boxShadow:"0 6px 22px rgba(0,0,0,.06)" }}>
        <div style={{ textAlign:"center", marginBottom:12 }}>
          <img src="/logo.png" alt="Teltrip" style={{ height:48 }} />
          <h1 style={{ margin:"10px 0 0 0" }}>Teltrip Dashboard</h1>
        </div>

        {err && <div style={{ background:"#ffefef", border:"1px solid #e5a5a5", color:"#900", padding:"8px 10px", borderRadius:8, marginBottom:10 }}>{err}</div>}

        <label style={{ display:"block", fontSize:13, marginBottom:4 }}>Username</label>
        <input value={user} onChange={e=>setUser(e.target.value)} autoComplete="username"
               style={{ width:"100%", padding:"10px 12px", borderRadius:10, border:"1px solid #cbd5a7", marginBottom:10 }} />

        <label style={{ display:"block", fontSize:13, marginBottom:4 }}>Password</label>
        <input value={pass} onChange={e=>setPass(e.target.value)} type="password" autoComplete="current-password"
               style={{ width:"100%", padding:"10px 12px", borderRadius:10, border:"1px solid #cbd5a7", marginBottom:14 }} />

        <button disabled={loading} style={{ width:"100%", padding:"10px 12px", borderRadius:10, border:"1px solid #cbd5a7", background:"#bfe080", cursor:"pointer" }}>
          {loading ? "Signing in…" : "Sign in"}
        </button>
      </form>
    </main>
  );
}
