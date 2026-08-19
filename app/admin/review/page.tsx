import { AdminHeader } from "@/components/admin/admin-header";
import { AdminSidebar } from "@/components/admin/admin-sidebar";
import { AdminGuard } from "@/components/admin/admin-guard";
import { ReviewQueue } from "@/components/admin/review-queue";

export default function AdminReviewPage() {
  return (
    <div className="min-h-screen bg-background">
      <AdminHeader />
      <div className="flex">
        <AdminSidebar />
        <main className="flex-1 p-6">
          <AdminGuard>
            <ReviewQueue />
          </AdminGuard>
        </main>
      </div>
    </div>
  );
}
