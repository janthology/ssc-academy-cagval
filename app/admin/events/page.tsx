import { AdminHeader } from "@/components/admin/admin-header";
import { AdminSidebar } from "@/components/admin/admin-sidebar";
import { AdminGuard } from "@/components/admin/admin-guard";
import { EventsManagementView } from "@/components/admin/events-management-view";

export default function AdminEventsPage() {
  return (
    <div className="min-h-screen bg-background">
      <AdminHeader />
      <div className="flex">
        <AdminSidebar />
        <main className="flex-1 p-6">
          <AdminGuard>
            <EventsManagementView />
          </AdminGuard>
        </main>
      </div>
    </div>
  );
}
