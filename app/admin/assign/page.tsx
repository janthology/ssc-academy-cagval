import { AdminHeader } from "@/components/admin/admin-header";
import { AdminSidebar } from "@/components/admin/admin-sidebar";
import { AdminGuard } from "@/components/admin/admin-guard";
import { AssignModulesView } from "@/components/admin/assign-modules-view";

export default function AdminAssignPage() {
  return (
    <div className="min-h-screen bg-background">
      <AdminHeader />
      <div className="flex">
        <AdminSidebar />
        <main className="flex-1 p-6">
          <AdminGuard>
            <AssignModulesView />
          </AdminGuard>
        </main>
      </div>
    </div>
  );
}
