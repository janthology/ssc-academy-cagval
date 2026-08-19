"use client"

import { useCallback, useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import dynamic from "next/dynamic"
import Link from "next/link"
import { supabaseBrowser } from "@/lib/supabase/browser-client"
import { useUser } from "@/components/providers/user-provider"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Badge } from "@/components/ui/badge"
import { Switch } from "@/components/ui/switch"
import { ArrowLeft, Upload, Plus, Trash2, Send, Save, Lock } from "lucide-react"

// Same SSR guard as module-content.tsx: react-pdf touches DOMMatrix at import
// time, which crashes server rendering.
const PdfViewer = dynamic(
  () => import("@/components/courses/pdf-viewer").then((m) => m.PdfViewer),
  { ssr: false }
)

type Lesson = {
  id?: string
  title: string
  start_page: number
  duration: number
  order: number
}

const EDITABLE = new Set(["draft", "rejected"])

export function ModuleEditor({
  courseId,
  moduleId,
}: {
  courseId: string | null // null = standalone/orphan module (no course yet)
  moduleId: string // real uuid, or the literal "new"
}) {
  const router = useRouter()
  const { profile } = useUser()
  const isNew = moduleId === "new"

  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)

  // The module's ACTUAL course assignment (null = unassigned). Drives the storage
  // path and the header label; distinct from the route's courseId prop.
  const [moduleCourseId, setModuleCourseId] = useState<string | null>(courseId)
  const [courseTitle, setCourseTitle] = useState("")
  const [status, setStatus] = useState<string>("draft")
  const [reviewNotes, setReviewNotes] = useState<string | null>(null)
  const [savedModuleId, setSavedModuleId] = useState<string | null>(isNew ? null : moduleId)

  const [title, setTitle] = useState("")
  const [description, setDescription] = useState("")
  const [order, setOrder] = useState("1")
  const [estimatedDuration, setEstimatedDuration] = useState("30")
  const [isRequired, setIsRequired] = useState(true)

  const [pdfPath, setPdfPath] = useState<string | null>(null)
  const [pdfUrl, setPdfUrl] = useState<string | null>(null)
  const [numPages, setNumPages] = useState(0)
  const [currentPage, setCurrentPage] = useState(1)

  const [lessons, setLessons] = useState<Lesson[]>([])
  const [lessonTitle, setLessonTitle] = useState("")
  const [lessonDuration, setLessonDuration] = useState("5")

  const editable = EDITABLE.has(status)

  const signPdf = useCallback(async (path: string) => {
    const { data } = await supabaseBrowser.storage
      .from("course-materials")
      .createSignedUrl(path, 86400)
    if (data?.signedUrl) setPdfUrl(data.signedUrl)
  }, [])

  useEffect(() => {
    const load = async () => {
      try {
        const setCourseLabel = async (cid: string | null) => {
          setModuleCourseId(cid)
          if (cid) {
            const { data: course } = await supabaseBrowser
              .from("courses").select("title").eq("id", cid).maybeSingle()
            setCourseTitle(course?.title ?? "Unknown course")
          } else {
            setCourseTitle("Not assigned to a course yet")
          }
        }

        if (isNew) {
          await setCourseLabel(courseId)
          if (courseId) {
            // Suggest the next order among this course's modules.
            const { data: siblings } = await supabaseBrowser
              .from("modules").select("order").eq("course_id", courseId)
            const maxOrder = (siblings ?? []).reduce(
              (max: number, m: { order: number }) => Math.max(max, m.order ?? 0), 0
            )
            setOrder(String(maxOrder + 1))
          } else {
            setOrder("1") // orphan module has no course siblings
          }
          return
        }

        const { data: mod, error: modError } = await supabaseBrowser
          .from("modules")
          .select("id, title, description, order, estimated_duration, is_required, status, review_notes, course_id")
          .eq("id", moduleId)
          .single()
        if (modError) throw new Error(modError.message)

        setTitle(mod.title ?? "")
        setDescription(mod.description ?? "")
        setOrder(String(mod.order ?? 1))
        setEstimatedDuration(String(mod.estimated_duration ?? 30))
        setIsRequired(!!mod.is_required)
        setStatus(mod.status)
        setReviewNotes(mod.review_notes)
        await setCourseLabel(mod.course_id) // the module's REAL assignment

        const { data: resource } = await supabaseBrowser
          .from("resources")
          .select("id, path")
          .eq("module_id", moduleId)
          .eq("type", "pdf")
          .maybeSingle()
        if (resource?.path) {
          setPdfPath(resource.path)
          await signPdf(resource.path)
        }

        const { data: lessonRows } = await supabaseBrowser
          .from("lessons")
          .select("id, title, start_page, duration, order")
          .eq("module_id", moduleId)
          .order("order")
        setLessons((lessonRows ?? []) as Lesson[])
      } catch (err: any) {
        setError(err.message || "Failed to load module.")
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [courseId, moduleId, isNew, signPdf])

  const validateMetadata = () => {
    if (!title.trim()) return "Module title is required."
    if (!description.trim()) return "Module description is required."
    const o = Number(order)
    const d = Number(estimatedDuration)
    if (!Number.isInteger(o) || o < 1) return "Order must be a whole number of 1 or more."
    if (!Number.isInteger(d) || d < 1) return "Estimated duration must be a whole number of 1 or more."
    return null
  }

  // Ascending start_page across the module's lessons, and every page must exist
  // in the uploaded PDF. numPages is only known once the viewer has parsed it.
  const validateLessons = (list: Lesson[]) => {
    if (numPages > 0) {
      const bad = list.find((l) => l.start_page < 1 || l.start_page > numPages)
      if (bad) return `"${bad.title}" starts on page ${bad.start_page}, but the PDF has ${numPages} pages.`
    }
    for (let i = 1; i < list.length; i++) {
      if (list[i].start_page <= list[i - 1].start_page) {
        return `Start pages must increase: "${list[i].title}" (page ${list[i].start_page}) does not come after "${list[i - 1].title}" (page ${list[i - 1].start_page}).`
      }
    }
    return null
  }

  const saveDraft = async (): Promise<string | null> => {
    setError(null); setNotice(null)
    const metaError = validateMetadata()
    if (metaError) { setError(metaError); return null }
    const lessonError = validateLessons(lessons)
    if (lessonError) { setError(lessonError); return null }

    if (!profile?.id) { setError("Not signed in."); return null }

    setBusy(true)
    try {
      // course_id + created_by are set only at INSERT. Updates never touch them:
      // created_by is immutable, and course_id assignment is admin-only (013 trigger).
      const basePayload = {
        title: title.trim(),
        description: description.trim(),
        order: Number(order),
        estimated_duration: Number(estimatedDuration),
        is_required: isRequired,
      }

      let id = savedModuleId
      if (!id) {
        // status left to the column default ('draft'). created_by MUST be the
        // caller (013 modules_instructor_insert WITH CHECK). course_id is the
        // route context — null for a standalone/orphan module.
        const { data, error: insertError } = await supabaseBrowser
          .from("modules")
          .insert({ ...basePayload, course_id: courseId, created_by: profile.id })
          .select("id, status")
          .single()
        if (insertError) throw new Error(insertError.message)
        id = data.id
        setSavedModuleId(id)
        setStatus(data.status)
        setModuleCourseId(courseId)
      } else {
        const { error: updateError } = await supabaseBrowser
          .from("modules")
          .update(basePayload)
          .eq("id", id)
        if (updateError) throw new Error(updateError.message)
      }

      await persistLessons(id!)
      setNotice("Draft saved.")
      if (isNew) {
        router.replace(courseId
          ? `/instructor/courses/${courseId}/modules/${id}`
          : `/instructor/modules/${id}`)
      }
      return id
    } catch (err: any) {
      setError(err.message || "Failed to save draft.")
      return null
    } finally {
      setBusy(false)
    }
  }

  // Lessons are replaced wholesale — simpler than diffing, and a module's lesson
  // list is small. type is always 'text': lessons_type_check has no 'pdf' value;
  // the PDF itself lives in the single resources row.
  const persistLessons = async (id: string) => {
    const { error: deleteError } = await supabaseBrowser.from("lessons").delete().eq("module_id", id)
    if (deleteError) throw new Error(deleteError.message)

    // A DELETE that RLS filters out reports no error and removes nothing, which
    // would turn this replace into an append and duplicate every section. Verify
    // the table is actually empty before re-inserting.
    const { count: leftover, error: countError } = await supabaseBrowser
      .from("lessons")
      .select("id", { count: "exact", head: true })
      .eq("module_id", id)
    if (countError) throw new Error(countError.message)
    if ((leftover ?? 0) > 0) {
      throw new Error(
        "Existing sections could not be removed, so they were not rewritten " +
        "(missing delete permission on lessons). No changes were saved to the section list."
      )
    }

    if (lessons.length === 0) return
    const { error: insertError } = await supabaseBrowser.from("lessons").insert(
      lessons.map((l, i) => ({
        module_id: id,
        title: l.title,
        type: "text",
        order: i + 1,
        duration: l.duration,
        start_page: l.start_page,
      }))
    )
    if (insertError) throw new Error(insertError.message)
  }

  const handleUpload = async (file: File) => {
    setError(null); setNotice(null)
    if (file.type !== "application/pdf") { setError("Only PDF files are accepted."); return }

    let id = savedModuleId
    if (!id) {
      id = await saveDraft()
      if (!id) return
    }

    setBusy(true)
    try {
      // Orphan modules upload under 'unassigned'; the [4]=module_id segment is what
      // storage RLS keys on, so the object never needs moving after assignment.
      const path = `courses/${moduleCourseId ?? "unassigned"}/modules/${id}/material.pdf`
      const { error: uploadError } = await supabaseBrowser.storage
        .from("course-materials")
        .upload(path, file, { upsert: true, contentType: "application/pdf" })
      if (uploadError) throw new Error(uploadError.message)

      const { data: existing } = await supabaseBrowser
        .from("resources")
        .select("id")
        .eq("module_id", id)
        .eq("type", "pdf")
        .maybeSingle()

      if (existing?.id) {
        const { error: updateError } = await supabaseBrowser
          .from("resources").update({ path }).eq("id", existing.id)
        if (updateError) throw new Error(updateError.message)
      } else {
        const { error: insertError } = await supabaseBrowser
          .from("resources").insert({ module_id: id, type: "pdf", path })
        if (insertError) throw new Error(insertError.message)
      }

      setPdfPath(path)
      setNumPages(0)
      await signPdf(path)
      setNotice("PDF uploaded.")
    } catch (err: any) {
      setError(err.message || "Upload failed.")
    } finally {
      setBusy(false)
    }
  }

  const addLessonAtCurrentPage = () => {
    setError(null)
    if (!lessonTitle.trim()) { setError("Give the section a title before adding it."); return }
    const duration = Number(lessonDuration)
    if (!Number.isInteger(duration) || duration < 1) { setError("Section duration must be a whole number of 1 or more."); return }

    const next = [...lessons, {
      title: lessonTitle.trim(),
      start_page: currentPage,
      duration,
      order: lessons.length + 1,
    }].sort((a, b) => a.start_page - b.start_page).map((l, i) => ({ ...l, order: i + 1 }))

    const problem = validateLessons(next)
    if (problem) { setError(problem); return }

    setLessons(next)
    setLessonTitle("")
  }

  const submitForReview = async () => {
    setError(null); setNotice(null)
    if (!pdfPath) { setError("Upload the module PDF before submitting for review."); return }
    if (lessons.length === 0) { setError("Add at least one section before submitting for review."); return }

    const id = await saveDraft()
    if (!id) return

    setBusy(true)
    try {
      const { data: { user } } = await supabaseBrowser.auth.getUser()
      if (!user) throw new Error("Not signed in.")

      const { error: updateError } = await supabaseBrowser
        .from("modules")
        .update({
          status: "pending_review",
          submitted_by: user.id,
          submitted_at: new Date().toISOString(),
        })
        .eq("id", id)
      if (updateError) throw new Error(updateError.message)

      setStatus("pending_review")
      setNotice("Submitted for review. It is locked for editing until an administrator responds.")
    } catch (err: any) {
      setError(err.message || "Failed to submit for review.")
    } finally {
      setBusy(false)
    }
  }

  // A rejected module is moved back to draft explicitly — 009 blocks instructors
  // from editing anything that is still pending_review.
  const reopenForEditing = async () => {
    setError(null); setNotice(null)
    setBusy(true)
    try {
      const { error: updateError } = await supabaseBrowser
        .from("modules").update({ status: "draft" }).eq("id", savedModuleId!)
      if (updateError) throw new Error(updateError.message)
      setStatus("draft")
      setNotice("Module reopened for editing.")
    } catch (err: any) {
      setError(err.message || "Failed to reopen module.")
    } finally {
      setBusy(false)
    }
  }

  if (loading) return <div className="text-center p-6">Loading...</div>

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Button asChild variant="ghost" size="sm" className="gap-2">
          <Link href="/instructor">
            <ArrowLeft className="w-4 h-4" />
            My Courses
          </Link>
        </Button>
      </div>

      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-foreground">
            {isNew && !savedModuleId ? "New Module" : title || "Module"}
          </h2>
          <p className="text-muted-foreground">{courseTitle}</p>
        </div>
        <Badge variant={status === "rejected" ? "destructive" : status === "published" ? "default" : "secondary"}>
          {status.replace("_", " ")}
        </Badge>
      </div>

      {status === "rejected" && reviewNotes && (
        <Card className="border-destructive">
          <CardHeader>
            <CardTitle className="text-destructive text-base">Returned by reviewer</CardTitle>
            <CardDescription className="text-foreground">{reviewNotes}</CardDescription>
          </CardHeader>
        </Card>
      )}

      {!editable && (
        <Card className="border-muted">
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Lock className="w-4 h-4" />
              {status === "pending_review" ? "Locked while under review" : "Published — read only"}
            </CardTitle>
            <CardDescription>
              {status === "pending_review"
                ? "An administrator is reviewing this module. Editing reopens once they approve or return it."
                : "Published modules are managed by administrators."}
            </CardDescription>
          </CardHeader>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Module details</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="module-title">Title</Label>
            <Input id="module-title" value={title} disabled={!editable}
              onChange={(e) => setTitle(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="module-description">Description</Label>
            <Textarea id="module-description" rows={3} value={description} disabled={!editable}
              onChange={(e) => setDescription(e.target.value)} />
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label htmlFor="module-order">Order</Label>
              <Input id="module-order" type="number" min={1} value={order} disabled={!editable}
                onChange={(e) => setOrder(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="module-duration">Estimated duration (minutes)</Label>
              <Input id="module-duration" type="number" min={1} value={estimatedDuration} disabled={!editable}
                onChange={(e) => setEstimatedDuration(e.target.value)} />
            </div>
            <div className="flex items-center gap-3 pt-8">
              <Switch id="module-required" checked={isRequired} disabled={!editable}
                onCheckedChange={setIsRequired} />
              <Label htmlFor="module-required">Required</Label>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Module PDF</CardTitle>
          <CardDescription>
            One PDF per module. Sections below point at pages inside it.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {editable && (
            <div className="flex items-center gap-3">
              <Input
                id="module-pdf"
                type="file"
                accept="application/pdf"
                disabled={busy}
                className="max-w-sm"
                onChange={(e) => {
                  const file = e.target.files?.[0]
                  if (file) handleUpload(file)
                  e.target.value = ""
                }}
              />
              <span className="text-sm text-muted-foreground flex items-center gap-1">
                <Upload className="w-4 h-4" />
                {pdfPath ? "Replace PDF" : "Upload PDF"}
              </span>
            </div>
          )}

          {!pdfPath && <p className="text-sm text-muted-foreground">No PDF uploaded yet.</p>}

          {pdfUrl && (
            <PdfViewer
              url={pdfUrl}
              onDocumentLoad={setNumPages}
              onPageChange={setCurrentPage}
            />
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Sections</CardTitle>
          <CardDescription>
            Page through the PDF above, stop on the page a section starts, then add it —
            the start page is taken from what you are looking at.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {editable && pdfUrl && (
            <div className="flex flex-wrap items-end gap-3">
              <div className="space-y-2 flex-1 min-w-[16rem]">
                <Label htmlFor="lesson-title">Section title</Label>
                <Input id="lesson-title" value={lessonTitle}
                  onChange={(e) => setLessonTitle(e.target.value)} />
              </div>
              <div className="space-y-2 w-40">
                <Label htmlFor="lesson-duration">Minutes</Label>
                <Input id="lesson-duration" type="number" min={1} value={lessonDuration}
                  onChange={(e) => setLessonDuration(e.target.value)} />
              </div>
              <Button onClick={addLessonAtCurrentPage} disabled={busy} className="gap-2">
                <Plus className="w-4 h-4" />
                Add at page {currentPage}
              </Button>
            </div>
          )}

          {lessons.length === 0 ? (
            <p className="text-sm text-muted-foreground">No sections yet.</p>
          ) : (
            <div className="space-y-2">
              {lessons.map((l, i) => (
                <div key={`${l.title}-${l.start_page}`} className="flex items-center gap-3 p-3 border rounded-lg">
                  <span className="text-sm text-muted-foreground w-6">{i + 1}</span>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium truncate">{l.title}</p>
                    <p className="text-xs text-muted-foreground">
                      Starts on page {l.start_page} · {l.duration} min
                    </p>
                  </div>
                  {editable && (
                    <Button variant="ghost" size="sm" aria-label={`Remove ${l.title}`}
                      onClick={() => setLessons(
                        lessons.filter((_, idx) => idx !== i).map((x, idx) => ({ ...x, order: idx + 1 }))
                      )}>
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  )}
                </div>
              ))}
            </div>
          )}

          {numPages > 0 && (
            <p className="text-xs text-muted-foreground">PDF has {numPages} pages.</p>
          )}
        </CardContent>
      </Card>

      {error && <p className="text-sm text-destructive">{error}</p>}
      {notice && <p className="text-sm text-green-600">{notice}</p>}

      <div className="flex flex-wrap gap-3">
        {editable && (
          <>
            <Button variant="outline" onClick={saveDraft} disabled={busy} className="gap-2">
              <Save className="w-4 h-4" />
              Save draft
            </Button>
            <Button onClick={submitForReview} disabled={busy} className="gap-2">
              <Send className="w-4 h-4" />
              Submit for review
            </Button>
          </>
        )}
        {status === "rejected" && (
          <Button variant="secondary" onClick={reopenForEditing} disabled={busy}>
            Edit &amp; Resubmit
          </Button>
        )}
      </div>
    </div>
  )
}
