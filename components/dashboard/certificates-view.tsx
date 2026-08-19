"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Award, Download, Share2, Calendar, CheckCircle, Loader2, Eye, Check } from "lucide-react"
import { supabaseBrowser } from "@/lib/supabase/browser-client"
import type { Certificate, Enrollment } from "@/lib/types/database"
import Link from "next/link"

interface CertificatesViewProps {
  user?: { id: string }
}

export function CertificatesView({ user }: CertificatesViewProps) {
  const [certificates, setCertificates] = useState<Certificate[]>([])
  const [inProgress, setInProgress] = useState<Enrollment[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleDownload = async (certificateId: string, certificateNumber: string) => {
    try {
      const response = await fetch(`/certificates/${certificateId}/download`)
      if (!response.ok) {
        let errorMessage = "Failed to download PDF"
        try {
          const contentType = response.headers.get("content-type")
          if (contentType?.includes("application/json")) {
            const errorData = await response.json()
            errorMessage = errorData.error || errorMessage
            if (errorData.details) {
              errorMessage += `: ${errorData.details}`
            }
          } else {
            const text = await response.text()
            errorMessage += `: Server returned ${response.status} (${text.slice(0, 50)}...)`
          }
        } catch (jsonError) {
          errorMessage += ": Unable to parse error response"
        }
        throw new Error(errorMessage)
      }
      const blob = await response.blob()
      const url = window.URL.createObjectURL(blob)
      const link = document.createElement("a")
      link.href = url
      link.download = `certificate-${certificateNumber}.pdf`
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      window.URL.revokeObjectURL(url)
    } catch (err: any) {
      alert(`Failed to download PDF: ${err.message}`)
    }
  }

  useEffect(() => {
    if (!user?.id) {
      setError("Please log in to view your certificates.")
      return
    }

    const fetchData = async () => {
      setIsLoading(true)
      try {
        // Fetch certificates
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
            course:courses(id, title, instructor, skills)
          `)
          .eq("user_id", user.id)

        if (certError) {
          throw new Error(`Supabase certificates query failed: ${JSON.stringify(certError)}`)
        }

        const formattedCerts: Certificate[] = (certData || []).map(cert => ({
          id: cert.id,
          user_id: cert.user_id,
          course_id: cert.course_id,
          certificate_number: cert.certificate_number,
          issued_at: cert.issued_at,
          verification_hash: cert.verification_hash,
          status: cert.status,
          course: Array.isArray(cert.course) ? cert.course[0] : cert.course,
        }))

        setCertificates(formattedCerts)

        // Fetch in-progress enrollments
        const { data: enrollData, error: enrollError } = await supabaseBrowser
          .from("enrollments")
          .select(`
            id,
            user_id,
            course_id,
            status,
            progress,
            enrolled_at,
            last_accessed_at,
            grade,
            course:courses(id, title)
          `)
          .eq("user_id", user.id)
          .eq("status", "active")
          .lt("progress", 100)

        if (enrollError) {
          throw new Error(`Supabase enrollments query failed: ${JSON.stringify(enrollError)}`)
        }

        const formattedEnrollments: Enrollment[] = (enrollData || []).map(enrollment => ({
          id: enrollment.id,
          user_id: enrollment.user_id,
          course_id: enrollment.course_id,
          status: enrollment.status,
          progress: enrollment.progress,
          enrolled_at: enrollment.enrolled_at,
          last_accessed_at: enrollment.last_accessed_at,
          grade: enrollment.grade,
          course: Array.isArray(enrollment.course) ? enrollment.course[0] : enrollment.course,
        }))

        setInProgress(formattedEnrollments)
      } catch (err: any) {
        setError(err.message || "Failed to load certificates and courses. Please try again.")
      } finally {
        setIsLoading(false)
      }
    }
    fetchData()
  }, [user?.id])

  if (isLoading) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="text-center">
          <Loader2 className="h-8 w-8 animate-spin mx-auto" />
          <p className="mt-2 text-muted-foreground">Loading your certificates...</p>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="container mx-auto px-4 py-8">
        <p className="text-red-600">{error}</p>
      </div>
    )
  }

  // Calculate total skills
  const totalSkills = certificates.reduce((acc, cert) => acc + (cert.course?.skills?.length || 0), 0)

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground font-serif">My Certificates</h1>
          <p className="text-muted-foreground">Your achievements and professional credentials</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" className="gap-2 bg-transparent" disabled>
            <Share2 className="w-4 h-4" />
            Share Profile
          </Button>
          <Button variant="outline" className="gap-2 bg-transparent" disabled>
            <Download className="w-4 h-4" />
            Download All
          </Button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Certificates Earned</CardTitle>
            <Award className="h-4 w-4 text-green-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{certificates.length}</div>
            <p className="text-xs text-muted-foreground">+{certificates.filter(c => new Date(c.issued_at).getMonth() === new Date().getMonth()).length} this month</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">In Progress</CardTitle>
            <CheckCircle className="h-4 w-4 text-blue-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{inProgress.length}</div>
            <p className="text-xs text-muted-foreground">Courses near completion</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Skills Acquired</CardTitle>
            <Badge className="h-4 w-4 text-purple-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalSkills}</div>
            <p className="text-xs text-muted-foreground">Verified competencies</p>
          </CardContent>
        </Card>
      </div>

      {/* Earned Certificates */}
      <div className="space-y-4">
        <h2 className="text-2xl font-bold text-foreground">Earned Certificates</h2>
        <div className="grid gap-6">
          {certificates.length > 0 ? (
            certificates.map((cert) => (
              <Card key={cert.id} className="hover:shadow-lg transition-shadow">
                <CardContent className="p-6">
                  <div className="flex gap-6">
                    <div className="w-32 h-24 bg-gradient-to-br from-primary/10 to-primary/5 rounded-lg flex items-center justify-center flex-shrink-0 border">
                      <Award className="w-12 h-12 text-primary" />
                    </div>

                    <div className="flex-1 space-y-4">
                      <div className="flex items-start justify-between">
                        <div>
                          <h3 className="text-xl font-semibold">{cert.course?.title || "Unknown Course"}</h3>
                          <p className="text-muted-foreground">by {cert.course?.instructor || "Unknown Instructor"}</p>
                        </div>
                        <Badge variant="default" className={cert.status === "active" ? "bg-green-100 text-green-800" : "bg-red-100 text-red-800"}>
                          {cert.status.charAt(0).toUpperCase() + cert.status.slice(1)}
                        </Badge>
                      </div>

                      <div className="grid grid-cols-2 lg:grid-cols-3 gap-4 text-sm">
                        <div className="flex items-center gap-2">
                          <Calendar className="w-4 h-4 text-primary" />
                          <span>Issued: {cert.issued_at ? new Date(cert.issued_at).toLocaleDateString() : "N/A"}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <CheckCircle className="w-4 h-4 text-green-500" />
                          <span>ID: {cert.certificate_number}</span>
                        </div>
                      </div>

                      <div>
                        <h4 className="font-medium mb-2">Skills Demonstrated:</h4>
                        <div className="flex flex-wrap gap-2">
                          {cert.course?.skills?.length ? (
                            cert.course.skills.map((skill) => (
                              <Badge key={skill} variant="outline" className="text-xs">
                                {skill}
                              </Badge>
                            ))
                          ) : (
                            <p className="text-xs text-muted-foreground">No skills listed</p>
                          )}
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        <Button variant="default"
                          size="sm" 
                          className="gap-2 cursor-pointer" 
                          onClick={() => handleDownload(cert.id, cert.certificate_number)}
                        >
                          <Download className="w-4 h-4" />
                          Download PDF
                        </Button>
                        <Button variant="outline" size="sm" className="gap-2 bg-transparent" disabled>
                          <Share2 className="w-4 h-4" />
                          Share
                        </Button>
                        <Button variant="secondary" size="sm" className="gap-2 bg-green-500" asChild>
                          <Link href={`/certificates/${cert.id}`}>
                            <Eye className="w-4 h-4" />
                            View Certificate
                          </Link>
                        </Button>
                        <Button variant="outline" size="sm" className="bg-transparent" asChild>
                          <Link href={`/verify/${cert.id}`}>
                            <CheckCircle className="w-4 h-4" />
                            Verify Certificate
                          </Link>
                        </Button>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))
          ) : (
            <p className="text-muted-foreground">No certificates earned yet.</p>
          )}
        </div>
      </div>

      {/* In Progress */}
      <div className="space-y-4">
        <h2 className="text-2xl font-bold text-foreground">Certificates in Progress</h2>
        <div className="grid gap-4">
          {inProgress.length > 0 ? (
            inProgress.map((enrollment) => (
              <Card key={enrollment.id}>
                <CardContent className="p-6">
                  <div className="flex items-center justify-between">
                    <div className="flex-1">
                      <h3 className="font-semibold">{enrollment.course?.title || "Unknown Course"}</h3>
                      <p className="text-sm text-muted-foreground">
                        Estimated completion: N/A
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-medium">{enrollment.progress}% complete</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))
          ) : (
            <p className="text-muted-foreground">No courses in progress.</p>
          )}
        </div>
      </div>
    </div>
  )
}