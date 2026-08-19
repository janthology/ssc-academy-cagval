import { LearningPathsDashboard } from "@/components/dashboard/learning-paths-dashboard"
import { DashboardSidebar } from "@/components/dashboard/dashboard-sidebar"
import { Header } from "@/components/ui/header"

export default function DashboardLearningPathsPage() {
  return (
    <div className="min-h-screen bg-background">
      {/* Sidebar */}
      <Header />
        {/* Main Content */}
      <div className="flex">
        <DashboardSidebar />
        <main className="flex-1 p-6">
          <LearningPathsDashboard />
        </main>
      </div>
    </div>
  )
}