import { DashboardHeader } from "@/components/dashboard/dashboard-header"
import { DashboardSidebar } from "@/components/dashboard/dashboard-sidebar"
import { ProfileSettings } from "@/components/dashboard/profile-settings"

export default function DashboardProfilePage() {
  return (
    <div className="min-h-screen bg-background">
      <DashboardHeader />
      <div className="flex">
        <DashboardSidebar />
        <main className="flex-1 p-6">
          <ProfileSettings />
        </main>
      </div>
    </div>
  )
}
