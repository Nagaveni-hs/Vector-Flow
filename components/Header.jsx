"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

export default function Header() {
  const [user, setUser] = useState(null);
  useEffect(() => {
    fetch("/api/auth/me")
      .then((r) => r.json())
      .then((j) => {
        if (j.ok) setUser(j.data.user);
      })
      .catch(() => {});
  }, []);
  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    window.location.href = "/";
  }
  return (
    <header>
      <strong>Vector Flow</strong> <span>VVCE, CSE (AI &amp; ML)</span>
      <nav>
        <Link href="/">Home</Link>
        <Link href="/participation">Participation</Link>
        {user && user.role === "ADMIN" && <Link href="/admin">Admin</Link>}
        {user ? (
          <>
            <span>{user.name}</span>
            <button onClick={logout}>Sign out</button>
          </>
        ) : (
          <Link href="/signin">Sign in</Link>
        )}
      </nav>
    </header>
  );
}
