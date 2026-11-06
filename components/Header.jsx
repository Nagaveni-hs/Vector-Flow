"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState, useCallback } from "react";
import BrandLogo from "@/components/BrandLogo";

export default function Header() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [menuOpen, setMenuOpen] = useState(false);
  const pathname = usePathname();

  // P0 (M3): re-fetch the session on every navigation, not just on
  // mount, so the Header cannot show a stale signed-in / signed-out
  // state after a client-side navigation. While loading, show nothing
  // in the account slot instead of flashing a wrong "Sign in" link.
  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    fetch("/api/auth/me")
      .then((r) => r.json())
      .then((j) => {
        if (cancelled) return;
        if (j.ok) setUser(j.data.user);
        else setUser(null);
      })
      .catch(() => {
        if (!cancelled) setUser(null);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [pathname]);

  // Automatically close menu when navigating to another route
  useEffect(() => {
    setMenuOpen(false);
  }, [pathname]);

  // Handle escape key and body scroll lock when mobile overlay is active
  useEffect(() => {
    function handleKeyDown(e) {
      if (e.key === "Escape" && menuOpen) {
        setMenuOpen(false);
      }
    }

    if (menuOpen) {
      document.body.style.overflow = "hidden";
      window.addEventListener("keydown", handleKeyDown);
    } else {
      document.body.style.overflow = "";
    }

    return () => {
      document.body.style.overflow = "";
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [menuOpen]);

  const closeMenu = useCallback(() => {
    setMenuOpen(false);
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
        <Link className="site-brand" href="/" aria-label="Vector Flow home" onClick={closeMenu}>
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
          <span aria-hidden="true">{menuOpen ? "✕" : "☰"}</span>
        </button>

        {/* Semi-transparent navy/slate backdrop: bg-slate-900/60 backdrop-blur-sm */}
        <div
          className={`site-nav-backdrop${menuOpen ? " is-open" : ""}`}
          onClick={closeMenu}
          aria-hidden="true"
        />

        {/* Floating/sliding overlay drawer on mobile */}
        <nav
          className={`site-nav${menuOpen ? " is-open" : ""}`}
          id="site-navigation"
          aria-label="Main navigation"
        >
          {/* Drawer header with brand slate/navy accents and 'X' close button */}
          <div className="site-drawer__header">
            <div className="site-drawer__brand">
              <BrandLogo className="site-drawer__logo" />
              <div className="site-drawer__copy">
                <strong>Vector Flow</strong>
                <span>Navigation</span>
              </div>
            </div>
            <button
              className="site-drawer__close"
              type="button"
              aria-label="Close navigation menu"
              onClick={closeMenu}
            >
              <span aria-hidden="true">✕</span>
            </button>
          </div>

          <div className="site-nav__links">
            <Link className={navLinkClass("/")} href="/" aria-current={pathname === "/" ? "page" : undefined} onClick={closeMenu}>
              <span>Home</span>
            </Link>
            <Link className={navLinkClass("/gallery")} href="/gallery" aria-current={pathname.startsWith("/gallery") ? "page" : undefined} onClick={closeMenu}>
              <span>Gallery</span>
            </Link>
            <Link className={navLinkClass("/team")} href="/team" aria-current={pathname.startsWith("/team") ? "page" : undefined} onClick={closeMenu}>
              <span>Team</span>
            </Link>
            <Link className={navLinkClass("/participation")} href="/participation" aria-current={pathname.startsWith("/participation") ? "page" : undefined} onClick={closeMenu}>
              <span>Participation</span>
            </Link>
            {user && user.role === "ADMIN" && (
              <Link className={navLinkClass("/admin")} href="/admin" aria-current={pathname.startsWith("/admin") ? "page" : undefined} onClick={closeMenu}>
                <span>Admin</span>
              </Link>
            )}
          </div>

          <div className="site-nav__account">
            {loading ? (
              <span aria-hidden="true" />
            ) : user ? (
              <>
                <span className="site-nav__user" title={user.name}>{user.name}</span>
                <button
                  className="site-nav__signout"
                  type="button"
                  onClick={() => {
                    closeMenu();
                    logout();
                  }}
                >
                  Sign out
                </button>
              </>
            ) : (
              <Link
                className="site-nav__signin"
                href="/signin"
                aria-current={pathname.startsWith("/signin") ? "page" : undefined}
                onClick={closeMenu}
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
