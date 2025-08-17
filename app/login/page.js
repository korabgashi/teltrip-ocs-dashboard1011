"use client";
import { useEffect, useState } from "react";
export default function Page(){
  const [rows,setRows] = useState([]);
  const [accountId,setAccountId] = useState("3432");
  const [error,setError] = useState("");
  async function load(){
    try{
      const r = await fetch(`/api/fetch-data?accountId=${accountId}`);
      const j = await r.json();
      if(!j.ok) throw new Error(j.error);
      setRows(j.data||[]);
    }catch(e){setError(e.message)}
  }
  useEffect(()=>{load()},[]);
  return <main style={{padding:20}}>
    <h1>Teltrip Dashboard</h1>
    <input value={accountId} onChange={e=>setAccountId(e.target.value)}/>
    <button onClick={load}>Load</button>
    {error && <div style={{color:"red"}}>{error}</div>}
    <pre>{JSON.stringify(rows,null,2)}</pre>
  </main>
}