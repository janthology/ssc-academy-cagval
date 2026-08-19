"use client"

import { useState, useEffect } from "react"
import { supabaseBrowser } from "@/lib/supabase/browser-client"
import { CertificatesView } from "@/components/dashboard/certificates-view"
import { DashboardHeader } from "@/components/dashboard/dashboard-header"
import { DashboardSidebar } from "@/components/dashboard/dashboard-sidebar"
import { Loader2 } from "lucide-react"

export default function DashboardCertificatesPage() {
  const [user, setUser] = useState<{ id: string } | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const fetchUser = async () => {
      setIsLoading(true)
      try {
        const { data: { user }, error } = await supabaseBrowser.auth.getUser()
        if (error) {
          throw new Error("Failed to fetch user data")
        }
        if (!user) {
          throw new Error("No authenticated user found")
        }
        setUser({ id: user.id })
      } catch (err: any) {
        setError(err.message || "Failed to load user data. Please try again.")
      } finally {
        setIsLoading(false)
      }
    }
    fetchUser()
  }, [])

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background">
        <DashboardHeader />
        <div className="flex">
          <DashboardSidebar />
          <main className="flex-1 p-6">
            <div className="text-center">
              <Loader2 className="h-8 w-8 animate-spin mx-auto" />
              <p className="mt-2 text-muted-foreground">Loading...</p>
            </div>
          </main>
        </div>
      </div>
    )
  }

  if (error || !user) {
    return (
      <div className="min-h-screen bg-background">
        <DashboardHeader />
        <div className="flex">
          <DashboardSidebar />
          <main className="flex-1 p-6">
            <p className="text-red-600">{error || "Please log in to view your certificates."}</p>
          </main>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background">
      <DashboardHeader />
      <div className="flex">
        <DashboardSidebar />
        <main className="flex-1 p-6">
          <CertificatesView user={user} />
        </main>
      </div>
    </div>
  )
}