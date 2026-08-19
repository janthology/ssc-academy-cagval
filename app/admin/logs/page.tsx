import { AdminHeader } from "@/components/admin/admin-header";
import { AdminSidebar } from "@/components/admin/admin-sidebar";
import { AdminGuard } from "@/components/admin/admin-guard";
import { AdminLogsView } from "@/components/admin/admin-logs-view";

export default function AdminLogsPage() {
  return (
    <div className="min-h-screen bg-background">
      <AdminHeader />
      <div className="flex">
        <AdminSidebar />
        <main className="flex-1 p-6">
          <AdminGuard>
            <AdminLogsView />
          </AdminGuard>
        </main>
      </div>
    </div>
  );
}
