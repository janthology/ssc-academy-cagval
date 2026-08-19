import { AdminHeader } from "@/components/admin/admin-header";
import { AdminSidebar } from "@/components/admin/admin-sidebar";
import { AdminDashboard } from "@/components/admin/admin-dashboard";
import { AdminGuard } from "@/components/admin/admin-guard";

export default function AdminPage() {
  return (
    <div className="min-h-screen bg-background">
      <AdminHeader />
      <div className="flex">
        <AdminSidebar />
        <main className="flex-1 p-6">
          <AdminGuard>
            <AdminDashboard />
          </AdminGuard>
        </main>
      </div>
    </div>
  );
}