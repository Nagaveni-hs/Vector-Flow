import AdminSidebar from "@/components/AdminSidebar";

export default function AdminLayout({ children }) {
  return (
    <div className="admin-shell">
      <AdminSidebar />
      <div className="admin-shell__content">{children}</div>
    </div>
  );
}
