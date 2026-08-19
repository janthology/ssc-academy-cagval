import { AdminHeader } from "@/components/admin/admin-header"
import { AdminSidebar } from "@/components/admin/admin-sidebar"
import { AnalyticsDashboard } from "@/components/admin/analytics-dashboard"

export default function AdminAnalyticsPage() {
  return (
    <div className="min-h-screen bg-background">
      <AdminHeader />
      <div className="flex">
        <AdminSidebar />
        <main className="flex-1 p-6">
          <AnalyticsDashboard />
        </main>
      </div>
    </div>
  )
}
