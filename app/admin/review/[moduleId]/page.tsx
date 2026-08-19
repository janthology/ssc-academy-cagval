import { AdminHeader } from "@/components/admin/admin-header";
import { AdminSidebar } from "@/components/admin/admin-sidebar";
import { AdminGuard } from "@/components/admin/admin-guard";
import { ReviewDetail } from "@/components/admin/review-detail";

export default async function AdminReviewDetailPage({
  params,
}: {
  params: Promise<{ moduleId: string }>;
}) {
  const { moduleId } = await params;

  return (
    <div className="min-h-screen bg-background">
      <AdminHeader />
      <div className="flex">
        <AdminSidebar />
        <main className="flex-1 p-6">
          <AdminGuard>
            <ReviewDetail moduleId={moduleId} />
          </AdminGuard>
        </main>
      </div>
    </div>
  );
}
