"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import BrandLogo from "@/components/BrandLogo";

export default function Header() {
  const [user, setUser] = useState(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const pathname = usePathname();
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

  function navLinkClass(href) {
    const active = href === "/" ? pathname === "/" : pathname.startsWith(href);
    return `site-nav__link${active ? " is-active" : ""}`;
  }

  return (
    <header className="site-header">
      <div className="site-header__inner">
        <Link className="site-brand" href="/" aria-label="Vector Flow home" onClick={() => setMenuOpen(false)}>
          <BrandLogo className="site-brand__logo" priority />
          <span className="site-brand__copy">
            <strong>Vector Flow</strong>
            <span>VVCE · CSE (AI &amp; ML)</span>
          </span>
        </Link>

        <button
          className="site-menu-toggle"
          type="button"
          aria-label={menuOpen ? "Close navigation menu" : "Open navigation menu"}
          aria-expanded={menuOpen}
          aria-controls="site-navigation"
          onClick={() => setMenuOpen((open) => !open)}
        >
          <span aria-hidden="true">{menuOpen ? "×" : "☰"}</span>
        </button>

        <nav
          className={`site-nav${menuOpen ? " is-open" : ""}`}
          id="site-navigation"
          aria-label="Main navigation"
        >
          <div className="site-nav__links">
            <Link className={navLinkClass("/")} href="/" aria-current={pathname === "/" ? "page" : undefined} onClick={() => setMenuOpen(false)}>
              Home
            </Link>
            <Link className={navLinkClass("/gallery")} href="/gallery" aria-current={pathname.startsWith("/gallery") ? "page" : undefined} onClick={() => setMenuOpen(false)}>
              Gallery
            </Link>
            <Link className={navLinkClass("/team")} href="/team" aria-current={pathname.startsWith("/team") ? "page" : undefined} onClick={() => setMenuOpen(false)}>
              Team
            </Link>
            <Link className={navLinkClass("/participation")} href="/participation" aria-current={pathname.startsWith("/participation") ? "page" : undefined} onClick={() => setMenuOpen(false)}>
              Participation
            </Link>
            {user && user.role === "ADMIN" && (
              <Link className={navLinkClass("/admin")} href="/admin" aria-current={pathname.startsWith("/admin") ? "page" : undefined} onClick={() => setMenuOpen(false)}>
                Admin
              </Link>
            )}
          </div>
          <div className="site-nav__account">
            {user ? (
              <>
                <span className="site-nav__user" title={user.name}>{user.name}</span>
                <button className="site-nav__signout" type="button" onClick={logout}>
                  Sign out
                </button>
              </>
            ) : (
              <Link
                className="site-nav__signin"
                href="/signin"
                aria-current={pathname.startsWith("/signin") ? "page" : undefined}
                onClick={() => setMenuOpen(false)}
              >
                Sign in
              </Link>
            )}
          </div>
        </nav>
      </div>
    </header>
  );
}
