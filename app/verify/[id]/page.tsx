"use client"

import { CertificateVerification } from "@/components/certificates/certificate-verification"
import { DashboardHeader } from "@/components/dashboard/dashboard-header"
import { DashboardSidebar } from "@/components/dashboard/dashboard-sidebar"
import { useUser } from "@/components/providers/user-provider"

export default function VerifyPage() {
  const { profile, loading } = useUser()
  const isAuthenticated = !!profile

  return (
    <div className="min-h-screen bg-background">
      <DashboardHeader />
      <div className="flex">
        {!loading && isAuthenticated && <DashboardSidebar />}
        <main className={!loading && isAuthenticated ? "flex-1 p-6" : "w-full p-6"}>
          <CertificateVerification />
        </main>
      </div>
    </div>
  )
}
