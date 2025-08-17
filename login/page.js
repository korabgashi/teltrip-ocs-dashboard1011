// app/login/page.js
'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';

export default function LoginPage() {
  const router = useRouter();
  const [err, setErr] = useState('');

  const signIn = async () => {
    setErr('');
    try {
      // Call a protected endpoint to trigger the browser's Basic Auth dialog
      const res = await fetch('/api/echo', { method: 'GET', cache: 'no-store' });
      if (res.ok) {
        router.replace('/'); // go to dashboard
      } else {
        setErr('Authentication cancelled or failed.');
      }
    } catch {
      setErr('Network error.');
    }
  };

  return (
    <div style={{minHeight:'100svh',display:'grid',placeItems:'center',background:'#0b1020',color:'#e9eef9',fontFamily:'system-ui'}}>
      <div style={{width:360,padding:24,background:'#121a36',borderRadius:16,boxShadow:'0 10px 30px rgba(0,0,0,.3)'}}>
        <h1 style={{margin:0,marginBottom:12,fontSize:24}}>Sign in</h1>
        <p style={{opacity:.8,marginTop:0,marginBottom:16,fontSize:14}}>
          Click the button and enter your username/password in the browser dialog.
        </p>
        {err && <div style={{color:'#ff6b6b',fontSize:13,marginBottom:12}}>{err}</div>}
        <button onClick={signIn} style={{width:'100%',padding:12,borderRadius:10,border:'none',background:'#3b82f6',color:'#fff',fontWeight:600,cursor:'pointer'}}>
          Continue
        </button>
      </div>
    </div>
  );
}
