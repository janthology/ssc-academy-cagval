"use client"

import { DashboardHeader } from "@/components/dashboard/dashboard-header"
import { DashboardSidebar } from "@/components/dashboard/dashboard-sidebar"
import { TeamProgressView } from "@/components/dashboard/team-progress-view"

export default function DashboardTeamPage() {
  return (
    <div className="min-h-screen bg-background">
      <DashboardHeader />
      <div className="flex">
        <DashboardSidebar />
        <main className="flex-1 p-6">
          <TeamProgressView />
        </main>
      </div>
    </div>
  )
}
