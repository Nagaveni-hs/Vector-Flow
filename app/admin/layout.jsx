import { redirect } from "next/navigation";
import AdminSidebar from "@/components/AdminSidebar";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/db";

// P0 (B2/B3): page-level admin guard. The middleware redirects
// signed-out and non-admin users, and this is the second check, with
// the role re-read from the DB, so the sidebar and admin pages are
// never even rendered for anyone who is not an admin right now.
export default async function AdminLayout({ children }) {
  const session = getSession();
  if (!session) redirect("/signin");
  const user = await prisma.user.findUnique({
    where: { id: session.userId },
    select: { role: true },
  });
  if (!user || user.role !== "ADMIN") redirect("/");
  return (
    <div className="admin-shell">
      <AdminSidebar />
      <div className="admin-shell__content">{children}</div>
    </div>
  );
}
