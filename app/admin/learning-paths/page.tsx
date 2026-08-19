import { AdminHeader } from "@/components/admin/admin-header";
import { AdminSidebar } from "@/components/admin/admin-sidebar";
import { AdminGuard } from "@/components/admin/admin-guard";
import { LearningPathsManagementView } from "@/components/admin/learning-paths-management-view";

export default function AdminLearningPathsPage() {
  return (
    <div className="min-h-screen bg-background">
      <AdminHeader />
      <div className="flex">
        <AdminSidebar />
        <main className="flex-1 p-6">
          <AdminGuard>
            <LearningPathsManagementView />
          </AdminGuard>
        </main>
      </div>
    </div>
  );
}
