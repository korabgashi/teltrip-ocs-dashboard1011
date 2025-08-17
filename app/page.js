// app/page.js
"use client";

import { useState, useEffect } from "react";

export default function Page() {
  const goToLogin = () => {
    // With Basic Auth there’s no true “logout”; send users to the /login helper page
    window.location.href = "/login";
  };

  return (
    <main style={{ padding: 24, fontFamily: "system-ui" }}>
      <header style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
        <h1 style={{ margin: 0 }}>OCS Dashboard</h1>
        <button
          onClick={goToLogin}
          style={{ padding: "10px 14px", borderRadius: 10, border: "1px solid #ddd", cursor: "pointer" }}
        >
          Go to Login
        </button>
      </header>

      <section>
        <p>You’re authenticated via Basic Auth. Build your dashboard here.</p>
        {/* TODO: add your existing tables, charts, API calls, etc. */}
      </section>
    </main>
  );
}
