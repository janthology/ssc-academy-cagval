"use client"

import { useState, useEffect } from "react"
import { useParams } from "next/navigation"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { AlertCircle, Award, Calendar, CheckCircle, Loader2, User, XCircle } from "lucide-react"

// Verification is served by GET /api/certificates/verify/[id], which returns only
// a minimal, non-sensitive field set (recipient name, course title, completion
// date) and a status distinguishing valid / revoked / not_found. This component
// never reads the certificates table directly.
type VerifyState =
  | { kind: "loading" }
  | { kind: "valid"; recipientName: string; courseTitle: string; completionDate: string }
  | { kind: "revoked" }
  | { kind: "not_found" }
  | { kind: "error" }

export function CertificateVerification() {
  const { id } = useParams<{ id: string }>()
  const [state, setState] = useState<VerifyState>({ kind: "loading" })

  useEffect(() => {
    let cancelled = false

    const run = async () => {
      setState({ kind: "loading" })
      try {
        const res = await fetch(`/api/certificates/verify/${id}`)
        const body = await res.json().catch(() => ({}))
        if (cancelled) return

        if (body?.status === "valid" && body.certificate) {
          setState({
            kind: "valid",
            recipientName: body.certificate.recipientName ?? "Unknown Recipient",
            courseTitle: body.certificate.courseTitle ?? "Unknown Course",
            completionDate: body.certificate.completionDate
              ? new Date(body.certificate.completionDate).toLocaleDateString()
              : "N/A",
          })
        } else if (body?.status === "revoked") {
          setState({ kind: "revoked" })
        } else if (body?.status === "not_found") {
          setState({ kind: "not_found" })
        } else {
          setState({ kind: "error" })
        }
      } catch {
        if (!cancelled) setState({ kind: "error" })
      }
    }

    run()
    return () => {
      cancelled = true
    }
  }, [id])

  const shell = (children: React.ReactNode) => (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto px-4 py-8">
        <Card className="max-w-4xl mx-auto">{children}</Card>
      </div>
    </div>
  )

  // ---- loading ----
  if (state.kind === "loading") {
    return (
      <div className="min-h-screen bg-background">
        <div className="container mx-auto px-4 py-8">
          <div className="text-center">
            <Loader2 className="h-8 w-8 animate-spin mx-auto" />
            <p className="mt-2 text-muted-foreground">Verifying certificate...</p>
          </div>
        </div>
      </div>
    )
  }

  // ---- not found ----
  if (state.kind === "not_found") {
    return shell(
      <>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <AlertCircle className="w-6 h-6 text-muted-foreground" />
            Certificate Not Found
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground">
            No certificate matches this verification link. Check that the link is complete and correct.
          </p>
        </CardContent>
      </>
    )
  }

  // ---- error ----
  if (state.kind === "error") {
    return shell(
      <>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <AlertCircle className="w-6 h-6 text-red-600" />
            Verification Error
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-red-600">We couldn&apos;t verify this certificate right now. Please try again.</p>
        </CardContent>
      </>
    )
  }

  // ---- revoked (distinct; does NOT show recipient/course/date) ----
  if (state.kind === "revoked") {
    return shell(
      <>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <XCircle className="w-6 h-6 text-red-600" />
            Certificate Revoked
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="bg-red-50 border border-red-200 p-8 rounded-lg text-center space-y-3">
            <XCircle className="w-10 h-10 text-red-600 mx-auto" />
            <h2 className="text-2xl font-bold text-red-700">This certificate has been revoked</h2>
            <p className="text-red-700/80">
              A certificate with this ID exists but is no longer valid. It has been revoked by DOST Region 2 and
              should not be accepted as proof of completion.
            </p>
          </div>
        </CardContent>
      </>
    )
  }

  // ---- valid (safe fields only) ----
  return shell(
    <>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Award className="w-6 h-6 text-primary" />
          Certificate Verification
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="bg-gradient-to-br from-primary/5 via-background to-secondary/5 p-8 rounded-lg">
          <div className="text-center space-y-4">
            <h2 className="text-3xl font-bold text-foreground">Certificate Verified</h2>
            <p className="text-muted-foreground">
              This certificate is valid and issued by the SSC Academy Cagayan Valley under the Smart and
              Sustainable Communities Program of DOST Region 2.
            </p>
            <div className="flex items-center justify-center gap-2">
              <CheckCircle className="w-6 h-6 text-green-500" />
              <span className="text-green-600 font-medium">Status: Valid</span>
            </div>
          </div>

          <div className="mt-6 space-y-6">
            <div className="text-center">
              <div className="flex items-center justify-center gap-2 text-muted-foreground">
                <User className="w-4 h-4" />
                <p>Recipient</p>
              </div>
              <h3 className="text-2xl font-bold">{state.recipientName}</h3>
            </div>

            <div className="text-center">
              <div className="flex items-center justify-center gap-2 text-muted-foreground">
                <Award className="w-4 h-4" />
                <p>Course</p>
              </div>
              <h4 className="text-xl font-bold">{state.courseTitle}</h4>
            </div>

            <div className="text-center">
              <div className="flex items-center justify-center gap-2 text-muted-foreground">
                <Calendar className="w-4 h-4" />
                <p>Completed</p>
              </div>
              <p className="font-semibold">{state.completionDate}</p>
            </div>
          </div>
        </div>
      </CardContent>
    </>
  )
}
