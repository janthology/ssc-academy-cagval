"use client"

import { useState, useEffect } from "react"
import { CertificateVerification } from "@/components/certificates/certificate-verification"
import { DashboardHeader } from "@/components/dashboard/dashboard-header"
import { DashboardSidebar } from "@/components/dashboard/dashboard-sidebar"
import { supabaseBrowser } from "@/lib/supabase/browser-client"

export default function VerifyPage() {
  const [isAuthenticated, setIsAuthenticated] = useState(false)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    const checkAuth = async () => {
      try {
        const { data: { user } } = await supabaseBrowser.auth.getUser()
        setIsAuthenticated(!!user)
      } catch (err) {
        setIsAuthenticated(false)
      } finally {
        setIsLoading(false)
      }
    }
    checkAuth()
  }, [])

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background">
        <DashboardHeader />
        <div className="container mx-auto px-4 py-8">
          <p className="text-center text-muted-foreground">Loading...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background">
      <DashboardHeader />
      <div className="flex">
        {isAuthenticated && <DashboardSidebar />}
        <main className={isAuthenticated ? "flex-1 p-6" : "w-full p-6"}>
          <CertificateVerification />
        </main>
      </div>
    </div>
  )
}