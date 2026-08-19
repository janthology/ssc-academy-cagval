"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import dynamic from "next/dynamic"
import Link from "next/link"
import { supabaseBrowser } from "@/lib/supabase/browser-client"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { ArrowLeft, Check, X, FileText } from "lucide-react"
import { recordAdminAction } from "@/lib/admin/log-client"

const PdfViewer = dynamic(
  () => import("@/components/courses/pdf-viewer").then((m) => m.PdfViewer),
  { ssr: false }
)

type Lesson = { id: string; title: string; start_page: number; duration: number; order: number }

export function ReviewDetail({ moduleId }: { moduleId: string }) {
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [title, setTitle] = useState("")
  const [description, setDescription] = useState("")
  const [status, setStatus] = useState("")
  const [courseId, setCourseId] = useState<string | null>(null)
  const [courseTitle, setCourseTitle] = useState("")
  const [instructorName, setInstructorName] = useState("")
  const [submittedAt, setSubmittedAt] = useState<string | null>(null)
  const [estimatedDuration, setEstimatedDuration] = useState<number | null>(null)
  const [isRequired, setIsRequired] = useState<boolean | null>(null)

  const [lessons, setLessons] = useState<Lesson[]>([])
  const [pdfUrl, setPdfUrl] = useState<string | null>(null)
  const [reviewNotes, setReviewNotes] = useState("")

  useEffect(() => {
    const load = async () => {
      try {
        const { data: mod, error: modError } = await supabaseBrowser
          .from("modules")
          .select("id, title, description, status, course_id, submitted_by, submitted_at, estimated_duration, is_required")
          .eq("id", moduleId)
          .single()
        if (modError) throw new Error(modError.message)

        setTitle(mod.title ?? "")
        setDescription(mod.description ?? "")
        setStatus(mod.status)
        setCourseId(mod.course_id)
        setSubmittedAt(mod.submitted_at)
        setEstimatedDuration(mod.estimated_duration)
        setIsRequired(mod.is_required)

        const [{ data: course }, { data: submitter }] = await Promise.all([
          supabaseBrowser.from("courses").select("title").eq("id", mod.course_id).maybeSingle(),
          mod.submitted_by
            ? supabaseBrowser.from("users").select("name").eq("id", mod.submitted_by).maybeSingle()
            : Promise.resolve({ data: null }),
        ])
        setCourseTitle(mod.course_id ? (course?.title ?? "Unknown course") : "Not yet assigned")
        setInstructorName(submitter?.name ?? "—")

        const { data: lessonRows } = await supabaseBrowser
          .from("lessons")
          .select("id, title, start_page, duration, order")
          .eq("module_id", moduleId)
          .order("order")
        setLessons((lessonRows ?? []) as Lesson[])

        const { data: resource } = await supabaseBrowser
          .from("resources")
          .select("path")
          .eq("module_id", moduleId)
          .eq("type", "pdf")
          .maybeSingle()
        if (resource?.path) {
          const { data: signed } = await supabaseBrowser.storage
            .from("course-materials")
            .createSignedUrl(resource.path, 86400)
          if (signed?.signedUrl) setPdfUrl(signed.signedUrl)
        }
      } catch (err: any) {
        setError(err.message || "Failed to load module.")
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [moduleId])

  const decide = async (decision: "published" | "rejected") => {
    setError(null)
    if (decision === "rejected" && !reviewNotes.trim()) {
      setError("Rejection requires notes so the instructor knows what to fix.")
      return
    }
    setBusy(true)
    try {
      const { data: { user } } = await supabaseBrowser.auth.getUser()
      if (!user) throw new Error("Not signed in.")

      const { error: updateError } = await supabaseBrowser
        .from("modules")
        .update({
          status: decision,
          reviewed_by: user.id,
          reviewed_at: new Date().toISOString(),
          review_notes: reviewNotes.trim() || null,
        })
        .eq("id", moduleId)
      if (updateError) throw new Error(updateError.message)

      recordAdminAction(decision === "published" ? "module_approved" : "module_rejected", moduleId, {
        message: `Module ${decision === "published" ? "approved" : "rejected"}: ${title}`,
      })

      // Publishing changes what the public course page shows — drop its cache so
      // the newly published module appears immediately. Best-effort.
      if (decision === "published" && courseId) {
        fetch("/api/revalidate", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ path: `/courses/${courseId}` }),
        }).catch(() => {})
      }

      router.push("/admin/review")
      router.refresh()
    } catch (err: any) {
      setError(err.message || "Failed to record decision.")
      setBusy(false)
    }
  }

  if (loading) return <div className="text-center p-6">Loading...</div>

  const notPending = status !== "pending_review"

  return (
    <div className="space-y-6">
      <Button asChild variant="ghost" size="sm" className="gap-2">
        <Link href="/admin/review">
          <ArrowLeft className="w-4 h-4" />
          Review queue
        </Link>
      </Button>

      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-foreground font-serif">{title}</h1>
          <p className="text-muted-foreground">
            {courseTitle} · submitted by {instructorName}
            {submittedAt && ` · ${new Date(submittedAt).toLocaleString("en-US", { year: "numeric", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}`}
          </p>
        </div>
        <Badge variant={status === "rejected" ? "destructive" : status === "published" ? "default" : "secondary"}>
          {status.replace("_", " ")}
        </Badge>
      </div>

      {notPending && (
        <Card className="border-muted">
          <CardHeader>
            <CardTitle className="text-base">Already {status.replace("_", " ")}</CardTitle>
            <CardDescription>
              This module is no longer pending review, so no decision can be recorded here.
            </CardDescription>
          </CardHeader>
        </Card>
      )}

      <Card>
        <CardHeader><CardTitle>Module details</CardTitle></CardHeader>
        <CardContent className="space-y-2 text-sm">
          <p>{description}</p>
          <div className="flex gap-6 text-muted-foreground">
            {estimatedDuration != null && <span>{estimatedDuration} min</span>}
            {isRequired != null && <span>{isRequired ? "Required" : "Optional"}</span>}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Sections ({lessons.length})</CardTitle>
          <CardDescription>Each points at a start page in the PDF below.</CardDescription>
        </CardHeader>
        <CardContent>
          {lessons.length === 0 ? (
            <p className="text-sm text-muted-foreground">No sections.</p>
          ) : (
            <div className="space-y-2">
              {lessons.map((l, i) => (
                <div key={l.id} className="flex items-center gap-3 p-3 border rounded-lg">
                  <span className="text-sm text-muted-foreground w-6">{i + 1}</span>
                  <FileText className="w-4 h-4 text-muted-foreground shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="font-medium truncate">{l.title}</p>
                    <p className="text-xs text-muted-foreground">Starts on page {l.start_page} · {l.duration} min</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Module PDF</CardTitle></CardHeader>
        <CardContent>
          {pdfUrl ? <PdfViewer url={pdfUrl} /> : <p className="text-sm text-muted-foreground">No PDF uploaded.</p>}
        </CardContent>
      </Card>

      {!notPending && (
        <Card>
          <CardHeader>
            <CardTitle>Decision</CardTitle>
            <CardDescription>Notes are required to reject, optional to approve.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="review-notes">Review notes</Label>
              <Textarea
                id="review-notes"
                rows={3}
                value={reviewNotes}
                onChange={(e) => setReviewNotes(e.target.value)}
                placeholder="What the instructor should know…"
              />
            </div>
            {error && <p className="text-sm text-destructive">{error}</p>}
            <div className="flex gap-3">
              <Button onClick={() => decide("published")} disabled={busy} className="gap-2">
                <Check className="w-4 h-4" />
                Approve &amp; publish
              </Button>
              <Button onClick={() => decide("rejected")} disabled={busy} variant="destructive" className="gap-2">
                <X className="w-4 h-4" />
                Reject
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {notPending && error && <p className="text-sm text-destructive">{error}</p>}
    </div>
  )
}
