"use client"

import { useState, useEffect } from "react"
import { useParams } from "next/navigation"
import { DashboardHeader } from "@/components/dashboard/dashboard-header"
import { DashboardSidebar } from "@/components/dashboard/dashboard-sidebar"
import { CertificateViewer } from "@/components/certificates/certificate-viewer"
import { CertificateActions } from "@/components/certificates/certificate-actions"
import { Button } from "@/components/ui/button"
import { ArrowLeft, Loader2 } from "lucide-react"
import { supabaseBrowser } from "@/lib/supabase/browser-client"
import type { Certificate } from "@/lib/types/database"
import Link from "next/link"

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export default function CertificatePage() {
  const { id } = useParams<{ id: string }>()
  const [certificate, setCertificate] = useState<Certificate | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const fetchCertificate = async () => {
      setIsLoading(true)
      try {
        if (!id || !UUID_REGEX.test(id)) {
          throw new Error(id ? "Invalid certificate ID format" : "No certificate ID provided")
        }

        // Get the authenticated user
        const { data: { user } } = await supabaseBrowser.auth.getUser()
        if (!user?.id) {
          throw new Error("User not authenticated")
        }

        const { data: certData, error: certError } = await supabaseBrowser
          .from("certificates")
          .select(`
            id,
            user_id,
            course_id,
            certificate_number,
            issued_at,
            verification_hash,
            status,
            course:courses(id, title, instructor, skills),
            user:users(id, name, organization, user_type, province, city)
          `)
          .eq("id", id)
          .eq("user_id", user.id)
          .single()

        if (certError) {
          if (certError.code === "PGRST116") {
            throw new Error("No certificate found for the given ID and user")
          }
          throw new Error(`Supabase certificate query failed: ${JSON.stringify(certError)}`)
        }

        if (!certData) {
          throw new Error("No certificate found for the given ID and user")
        }

        const { data: enrollmentData, error: enrollmentError } = await supabaseBrowser
          .from("enrollments")
          .select("course_id, user_id, grade")
          .eq("course_id", certData.course_id)
          .eq("user_id", certData.user_id)
          .maybeSingle()

        if (enrollmentError) {
          // Don't throw error for enrollment; allow null enrollment
        }

        const formattedData: Certificate = {
          id: certData.id,
          user_id: certData.user_id,
          course_id: certData.course_id,
          certificate_number: certData.certificate_number,
          issued_at: certData.issued_at,
          verification_hash: certData.verification_hash,
          status: certData.status,
          course: Array.isArray(certData.course) ? certData.course[0] : certData.course,
          user: Array.isArray(certData.user) ? certData.user[0] : certData.user,
          enrollment: enrollmentData ? (Array.isArray(enrollmentData) ? enrollmentData[0] : enrollmentData) : null,
        }

        setCertificate(formattedData)
      } catch (err: any) {
        setError(err.message || "Failed to load certificate. Please try again.")
      } finally {
        setIsLoading(false)
      }
    }
    fetchCertificate()
  }, [id])

  return (
    <div className="min-h-screen bg-background">
      <DashboardHeader />
      <div className="flex">
        <DashboardSidebar />
        <main className="flex-1 p-6">
          <div className="container mx-auto px-4 py-8">
            {isLoading ? (
              <div className="text-center">
                <Loader2 className="h-8 w-8 animate-spin mx-auto" />
                <p className="mt-2 text-muted-foreground">Loading certificate...</p>
              </div>
            ) : error || !certificate ? (
              <div>
                <p className="text-red-600">{error || "Certificate not found."}</p>
                <Button variant="outline" className="mt-4 bg-transparent" asChild>
                  <Link href="/dashboard/courses">
                    <ArrowLeft className="w-4 h-4 mr-2" /> Back to Courses
                  </Link>
                </Button>
              </div>
            ) : (
              <div className="max-w-4xl mx-auto space-y-6">
                <CertificateViewer certificate={certificate} />
                <CertificateActions certificate={certificate} />
              </div>
            )}
          </div>
        </main>
      </div>
    </div>
  )
}