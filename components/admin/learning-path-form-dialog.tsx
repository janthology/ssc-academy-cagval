"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { supabaseBrowser } from "@/lib/supabase/browser-client"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Badge } from "@/components/ui/badge"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { X, Plus, ArrowUp, ArrowDown } from "lucide-react"
import { recordAdminAction } from "@/lib/admin/log-client"

type CourseOption = { id: string; title: string; category: string; level: string }

export type EditableLearningPath = {
  id: string
  title: string
  description: string
  target_audience: string[] | null
  status: "active" | "archived"
  courses: { course_id: string; course_order: number }[]
}

// Real course titles repeat ("Smart City Fundamentals" x3, "Data Analytics for
// Smart Cities" x2), so the picker must disambiguate or an admin cannot tell
// which row they selected.
const courseLabel = (c: CourseOption) => `${c.title} — ${c.category} · ${c.level}`

/**
 * Shared create/edit learning-path dialog (controlled). `path` undefined =>
 * create (INSERT); present => edit (UPDATE by id). Writes go through
 * learningpaths_admin_write / learningpath_courses_admin_write — no migration
 * was needed, those policies already existed.
 *
 * NOTE: the join column is `learningpath_id`, NOT `learning_path_id` (which is
 * what 001_initial_schema.sql declares — live differs, see migration 006).
 *
 * Save is two-step, since PostgREST has no client-side transaction:
 *  - CREATE: insert the path, then insert its links. If the links fail, the
 *    just-created path row is DELETED again so no courseless orphan is left,
 *    and the error says nothing was saved.
 *  - EDIT: update the path, replace its links. A link failure there leaves a
 *    real, pre-existing row that can genuinely be reopened and retried, so the
 *    message says exactly that.
 */
export function LearningPathFormDialog({
  path,
  open,
  onOpenChange,
  onSaved,
}: {
  path?: EditableLearningPath | null
  open: boolean
  onOpenChange: (o: boolean) => void
  onSaved?: () => void
}) {
  const router = useRouter()
  const isEdit = !!path
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [title, setTitle] = useState("")
  const [description, setDescription] = useState("")
  const [status, setStatus] = useState<"active" | "archived">("active")
  const [audience, setAudience] = useState<string[]>([])
  const [audienceInput, setAudienceInput] = useState("")

  const [allCourses, setAllCourses] = useState<CourseOption[]>([])
  const [picked, setPicked] = useState<string[]>([]) // course ids; array order IS course_order
  const [toAdd, setToAdd] = useState("")

  useEffect(() => {
    if (!open) return
    if (path) {
      setTitle(path.title ?? "")
      setDescription(path.description ?? "")
      setStatus(path.status ?? "active")
      setAudience(path.target_audience ?? [])
      setPicked(
        [...path.courses].sort((a, b) => a.course_order - b.course_order).map((c) => c.course_id)
      )
    } else {
      setTitle("")
      setDescription("")
      setStatus("active")
      setAudience([])
      setPicked([])
    }
    setAudienceInput("")
    setToAdd("")
    setError(null)

    const loadCourses = async () => {
      const { data } = await supabaseBrowser
        .from("courses")
        .select("id,title,category,level")
        .eq("is_active", true)
        .order("category")
        .order("title")
      setAllCourses((data ?? []) as CourseOption[])
    }
    loadCourses()
  }, [open, path])

  const byId = (id: string) => allCourses.find((c) => c.id === id)
  const available = allCourses.filter((c) => !picked.includes(c.id))

  const addCourse = () => {
    if (!toAdd || picked.includes(toAdd)) return
    setPicked([...picked, toAdd])
    setToAdd("")
  }

  const move = (i: number, dir: -1 | 1) => {
    const j = i + dir
    if (j < 0 || j >= picked.length) return
    const next = [...picked]
    ;[next[i], next[j]] = [next[j], next[i]]
    setPicked(next)
  }

  const addAudienceTag = () => {
    const v = audienceInput.trim()
    if (!v) return
    if (!audience.some((a) => a.toLowerCase() === v.toLowerCase())) setAudience([...audience, v])
    setAudienceInput("")
  }

  const handleSubmit = async () => {
    setError(null)
    if (!title.trim()) return setError("Title is required.")
    if (!description.trim()) return setError("Description is required.")
    if (audience.length === 0) return setError("At least one target audience is required.")
    if (picked.length === 0) return setError("Add at least one course to the path.")

    const payload = {
      title: title.trim(),
      description: description.trim(),
      target_audience: audience,
      status,
      updated_at: new Date().toISOString(),
    }
    // Position in the list IS course_order, recomputed on every save so it can
    // never drift from what the admin sees.
    const links = (pathId: string) =>
      picked.map((course_id, i) => ({ learningpath_id: pathId, course_id, course_order: i + 1 }))

    setSaving(true)
    try {
      if (isEdit && path) {
        const { error: updErr } = await supabaseBrowser
          .from("learningpaths")
          .update(payload)
          .eq("id", path.id)
        if (updErr) throw new Error(updErr.message)

        const { error: delErr } = await supabaseBrowser
          .from("learningpath_courses")
          .delete()
          .eq("learningpath_id", path.id)
        if (delErr) {
          throw new Error(
            `The path was saved, but its existing courses could not be cleared: ${delErr.message}. ` +
            `Reopen it and save again to finish.`
          )
        }

        const { error: linkErr } = await supabaseBrowser
          .from("learningpath_courses")
          .insert(links(path.id))
        if (linkErr) {
          throw new Error(
            `The path was saved, but attaching its courses failed: ${linkErr.message}. ` +
            `Reopen it and save again to finish.`
          )
        }

        recordAdminAction("learningpath_updated", path.id, {
          message: `Learning path updated: ${payload.title}`,
          data: { courses: picked.length },
        })
      } else {
        const { data: { user } } = await supabaseBrowser.auth.getUser()
        const { data: createdPath, error: insErr } = await supabaseBrowser
          .from("learningpaths")
          .insert({ ...payload, created_by: user?.id ?? null })
          .select("id")
          .single()
        if (insErr) throw new Error(insErr.message)

        // New path has no existing links, so go straight to the insert. If it
        // fails, roll the path row back — never leave a courseless orphan.
        const { error: linkErr } = await supabaseBrowser
          .from("learningpath_courses")
          .insert(links(createdPath.id))
        if (linkErr) {
          const { error: rollbackErr } = await supabaseBrowser
            .from("learningpaths")
            .delete()
            .eq("id", createdPath.id)
          if (rollbackErr) {
            throw new Error(
              `Creation failed while attaching courses (${linkErr.message}), and the ` +
              `partially created path could not be removed (${rollbackErr.message}). ` +
              `Check the learning paths list and delete it manually.`
            )
          }
          throw new Error(`Creation failed: ${linkErr.message}. Nothing was saved.`)
        }

        recordAdminAction("learningpath_created", null, {
          message: `Learning path created: ${payload.title}`,
          data: { title: payload.title, courses: picked.length },
        })
      }

      onSaved?.()
      onOpenChange(false)
      router.refresh()
    } catch (err: any) {
      setError(err.message || "Failed to save learning path.")
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{isEdit ? "Edit Learning Path" : "Create Learning Path"}</DialogTitle>
          <DialogDescription>
            An ordered sequence of existing courses. Only active courses can be added.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="lp-title">Title</Label>
            <Input
              id="lp-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. LGU Smart City Implementors"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="lp-description">Description</Label>
            <Textarea
              id="lp-description"
              rows={3}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Who is this path for, and what will they be able to do?"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="lp-audience">Target audience</Label>
            <Input
              id="lp-audience"
              placeholder="Type and press Enter to add (e.g. lgu, government, dost)"
              value={audienceInput}
              onChange={(e) => setAudienceInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault()
                  addAudienceTag()
                }
              }}
            />
            {audience.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {audience.map((a) => (
                  <Badge key={a} variant="secondary" className="gap-1">
                    {a}
                    <button
                      type="button"
                      onClick={() => setAudience(audience.filter((x) => x !== a))}
                      aria-label={`Remove ${a}`}
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </Badge>
                ))}
              </div>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="lp-status">Status</Label>
            <Select value={status} onValueChange={(v) => setStatus(v as "active" | "archived")}>
              <SelectTrigger id="lp-status"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="active">Active — visible to learners</SelectItem>
                <SelectItem value="archived">Archived — hidden from learners</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Courses in this path</Label>
            <div className="flex gap-2">
              <Select value={toAdd} onValueChange={setToAdd}>
                <SelectTrigger className="flex-1">
                  <SelectValue placeholder="Select a course to add…" />
                </SelectTrigger>
                <SelectContent>
                  {available.length === 0 ? (
                    <SelectItem value="__none" disabled>All active courses already added</SelectItem>
                  ) : (
                    available.map((c) => (
                      <SelectItem key={c.id} value={c.id}>{courseLabel(c)}</SelectItem>
                    ))
                  )}
                </SelectContent>
              </Select>
              <Button type="button" variant="outline" onClick={addCourse} disabled={!toAdd} className="gap-1">
                <Plus className="h-4 w-4" /> Add
              </Button>
            </div>

            {picked.length === 0 ? (
              <p className="rounded-lg border border-dashed p-4 text-center text-sm text-muted-foreground">
                No courses added yet.
              </p>
            ) : (
              <div className="space-y-2">
                {picked.map((id, i) => {
                  const c = byId(id)
                  return (
                    <div key={id} className="flex items-center gap-2 rounded-lg border p-2">
                      <span className="w-6 text-center text-sm font-medium text-muted-foreground">{i + 1}</span>
                      <span className="flex-1 text-sm">{c ? courseLabel(c) : id}</span>
                      <Button
                        type="button" variant="ghost" size="sm"
                        aria-label={`Move ${c?.title ?? id} up`}
                        onClick={() => move(i, -1)} disabled={i === 0}
                      >
                        <ArrowUp className="h-4 w-4" />
                      </Button>
                      <Button
                        type="button" variant="ghost" size="sm"
                        aria-label={`Move ${c?.title ?? id} down`}
                        onClick={() => move(i, 1)} disabled={i === picked.length - 1}
                      >
                        <ArrowDown className="h-4 w-4" />
                      </Button>
                      <Button
                        type="button" variant="ghost" size="sm"
                        aria-label={`Remove ${c?.title ?? id}`}
                        onClick={() => setPicked(picked.filter((x) => x !== id))}
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                  )
                })}
              </div>
            )}
          </div>

          {error && <p className="text-sm text-destructive">{error}</p>}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>Cancel</Button>
          <Button onClick={handleSubmit} disabled={saving}>
            {saving ? "Saving…" : isEdit ? "Save Changes" : "Create Learning Path"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
