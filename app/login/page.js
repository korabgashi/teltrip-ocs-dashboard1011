// app/login/page.js
"use client";
export const dynamic = "force-dynamic";
export const revalidate = 0;

import React, { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";

function LoginForm() {
  const router = useRouter();
  const sp = useSearchParams();                 // now inside Suspense
  const from = sp.get("from") || "/";

  const [u, setU] = useState("");
  const [p, setP] = useState("");
  const [err, setErr] = useState("");

  const submit = async (e) => {
    e.preventDefault();
    setErr("");
    const res = await fetch("/api/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username: u, password: p }),
      cache: "no-store",
    });
    if (res.ok) router.replace(from);
    else {
      const data = await res.json().catch(() => ({}));
      setErr(data?.error || "Invalid credentials");
    }
  };

  return (
    <div style={{minHeight:"100svh",display:"grid",placeItems:"center",background:"#0b1020",color:"#e9eef9",fontFamily:"system-ui"}}>
      <form onSubmit={submit} style={{width:360,padding:24,background:"#121a36",borderRadius:16,boxShadow:"0 10px 30px rgba(0,0,0,.3)"}}>
        <h1 style={{margin:0,marginBottom:16,fontSize:24}}>Sign in</h1>
        <label style={{display:"block",fontSize:14,marginBottom:6}}>Username</label>
        <input value={u} onChange={e=>setU(e.target.value)} required
               style={{width:"100%",padding:10,borderRadius:10,border:"1px solid #2b3764",background:"#0e1430",color:"#e9eef9",marginBottom:12}}/>
        <label style={{display:"block",fontSize:14,marginBottom:6}}>Password</label>
        <input type="password" value={p} onChange={e=>setP(e.target.value)} required
               style={{width:"100%",padding:10,borderRadius:10,border:"1px solid #2b3764",background:"#0e1430",color:"#e9eef9",marginBottom:16}}/>
        {err && <div style={{color:"#ff6b6b",fontSize:13,marginBottom:12}}>{err}</div>}
        <button type="submit" style={{width:"100%",padding:12,borderRadius:10,border:"none",background:"#3b82f6",color:"#fff",fontWeight:600,cursor:"pointer"}}>
          Login
        </button>
      </form>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={<div style={{color:"#e9eef9",textAlign:"center",padding:40}}>Loading…</div>}>
      <LoginForm />
    </Suspense>
  );
}
