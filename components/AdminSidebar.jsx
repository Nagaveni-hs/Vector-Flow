"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import BrandLogo from "@/components/BrandLogo";

const links = [
  { href: "/admin", label: "Dashboard", exact: true },
  { href: "/admin/events/new", label: "Create event" },
  { href: "/admin/team", label: "Team management" },
  { href: "/admin/handover", label: "Handover" },
  { href: "/admin/checks", label: "Local checks" },
];

export default function AdminSidebar() {
  const pathname = usePathname();

  return (
    <aside className="admin-sidebar" aria-label="Admin navigation">
      <Link className="admin-sidebar__brand" href="/admin" aria-label="Vector Flow admin dashboard">
        <BrandLogo className="admin-sidebar__logo" />
        <span>Club administration</span>
      </Link>
      <nav className="admin-sidebar__nav" aria-label="Admin pages">
        {links.map(({ href, label, exact }) => {
          const active = exact ? pathname === href : pathname.startsWith(href);
          return (
            <Link
              className={`admin-sidebar__link${active ? " is-active" : ""}`}
              href={href}
              key={href}
              aria-current={active ? "page" : undefined}
            >
              {label}
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}
