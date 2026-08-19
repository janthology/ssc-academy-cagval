"use client"

import { useEffect, useRef, useState } from "react"
import { useRouter } from "next/navigation"
import { supabaseBrowser } from "@/lib/supabase/browser-client"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Badge } from "@/components/ui/badge"
import { Switch } from "@/components/ui/switch"
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
import { Plus, X, Check, Info } from "lucide-react"
import { recordAdminAction } from "@/lib/admin/log-client"

type InstructorOption = { id: string; name: string; email: string }
type Suggestion = { id: string; title: string; score: number }

// Shape needed to prefill the form in edit mode.
export type EditableCourse = {
  id: string
  title: string
  description: string
  category: string
  level: "beginner" | "intermediate" | "advanced"
  duration: number
  target_audience: string[] | null
  prerequisites: string[] | null
  thumbnail: string
  instructor: string
  instructor_id: string | null
  is_active: boolean
}

const norm = (s: string) => s.trim().toLowerCase()

function revalidateCatalog() {
  fetch("/api/revalidate", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ path: "/courses" }),
  }).catch(() => {})
}

/**
 * Shared create/edit course dialog (controlled). `course` undefined => create
 * (INSERT); present => edit (UPDATE by id). Both go through courses_admin_write
 * RLS. The prerequisite tag-input + suggest_course_titles() logic is shared, not
 * rebuilt, so Edit behaves identically to Create.
 */
export function CourseFormDialog({
  course,
  open,
  onOpenChange,
  onSaved,
}: {
  course?: EditableCourse | null
  open: boolean
  onOpenChange: (o: boolean) => void
  onSaved?: () => void
}) {
  const router = useRouter()
  const isEdit = !!course
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [title, setTitle] = useState("")
  const [description, setDescription] = useState("")
  const [category, setCategory] = useState("")
  const [level, setLevel] = useState<"beginner" | "intermediate" | "advanced">("beginner")
  const [duration, setDuration] = useState("")
  const [thumbnail, setThumbnail] = useState("/placeholder.svg")
  const [isActive, setIsActive] = useState(true)

  const [instructorId, setInstructorId] = useState<string>("")
  const [instructorName, setInstructorName] = useState("")
  const [instructors, setInstructors] = useState<InstructorOption[]>([])

  const [audienceInput, setAudienceInput] = useState("")
  const [audience, setAudience] = useState<string[]>([])

  const [prereqInput, setPrereqInput] = useState("")
  const [prereqs, setPrereqs] = useState<string[]>([])
  const [suggestions, setSuggestions] = useState<Suggestion[]>([])
  const [activeTitles, setActiveTitles] = useState<string[]>([])
  const debounce = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Load instructor options + active titles, and (re)initialise fields whenever
  // the dialog opens — from `course` in edit mode, or defaults in create mode.
  useEffect(() => {
    if (!open) return

    if (course) {
      setTitle(course.title ?? "")
      setDescription(course.description ?? "")
      setCategory(course.category ?? "")
      setLevel(course.level ?? "beginner")
      setDuration(String(course.duration ?? ""))
      setThumbnail(course.thumbnail ?? "/placeholder.svg")
      setIsActive(course.is_active)
      setInstructorId(course.instructor_id ?? "")
      setInstructorName(course.instructor ?? "")
      setAudience(course.target_audience ?? [])
      setPrereqs(course.prerequisites ?? [])
    } else {
      setTitle(""); setDescription(""); setCategory(""); setLevel("beginner")
      setDuration(""); setThumbnail("/placeholder.svg"); setIsActive(true)
      setInstructorId(""); setInstructorName(""); setAudience([]); setPrereqs([])
    }
    setAudienceInput(""); setPrereqInput(""); setSuggestions([]); setError(null)

    const load = async () => {
      const { data: instr } = await supabaseBrowser
        .from("users")
        .select("id, name, email")
        .eq("is_instructor", true)
        .eq("status", "active")
        .order("name")
      setInstructors(instr ?? [])

      const { data: courses } = await supabaseBrowser
        .from("courses")
        .select("title")
        .eq("is_active", true)
      setActiveTitles((courses ?? []).map((c: { title: string }) => c.title))
    }
    load()
  }, [open, course])

  const prereqExactMatch = prereqInput.trim().length > 0 &&
    activeTitles.some((t) => norm(t) === norm(prereqInput))

  useEffect(() => {
    if (debounce.current) clearTimeout(debounce.current)
    const value = prereqInput.trim()
    if (value.length < 2 || prereqExactMatch) {
      setSuggestions([])
      return
    }
    debounce.current = setTimeout(async () => {
      const { data } = await supabaseBrowser.rpc("suggest_course_titles", { p_input: value })
      setSuggestions((data ?? []).slice(0, 5))
    }, 300)
    return () => {
      if (debounce.current) clearTimeout(debounce.current)
    }
  }, [prereqInput, prereqExactMatch])

  const addTag = (
    value: string,
    list: string[],
    setList: (v: string[]) => void,
    clear: () => void
  ) => {
    const v = value.trim()
    if (!v) return
    if (!list.some((item) => norm(item) === norm(v))) setList([...list, v])
    clear()
  }

  const pickInstructor = (id: string) => {
    setInstructorId(id)
    const found = instructors.find((i) => i.id === id)
    if (found) setInstructorName(found.name)
  }

  const handleSubmit = async () => {
    setError(null)

    if (!title.trim()) return setError("Title is required.")
    if (!description.trim()) return setError("Description is required.")
    if (!category.trim()) return setError("Category is required.")
    if (!instructorName.trim()) return setError("Instructor name is required.")
    if (!thumbnail.trim()) return setError("Thumbnail is required.")
    const durationNum = Number(duration)
    if (!Number.isInteger(durationNum) || durationNum <= 0) {
      return setError("Duration must be a whole number greater than 0.")
    }

    const payload = {
      title: title.trim(),
      description: description.trim(),
      category: category.trim(),
      level,
      duration: durationNum,
      target_audience: audience,
      prerequisites: prereqs.length > 0 ? prereqs : null,
      thumbnail: thumbnail.trim(),
      instructor: instructorName.trim(),
      instructor_id: instructorId || null,
      is_active: isActive,
    }

    setSaving(true)
    try {
      if (isEdit && course) {
        const { error: updateError } = await supabaseBrowser
          .from("courses")
          .update(payload)
          .eq("id", course.id)
        if (updateError) throw new Error(updateError.message)
        recordAdminAction("course_updated", course.id, { message: `Course updated: ${payload.title}` })
      } else {
        const { error: insertError } = await supabaseBrowser.from("courses").insert(payload)
        if (insertError) throw new Error(insertError.message)
        recordAdminAction("course_created", null, { data: { title: payload.title } })
      }

      revalidateCatalog()
      onSaved?.()
      onOpenChange(false)
      router.refresh()
    } catch (err: any) {
      setError(err.message || "Failed to save course.")
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{isEdit ? "Edit Course" : "Create Course"}</DialogTitle>
          <DialogDescription>
            {isEdit
              ? "Update this course's details. Modules and content are managed separately by the assigned instructor."
              : "Creates a real course record. Modules and content are added separately by the assigned instructor."}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="course-title">Title</Label>
            <Input id="course-title" value={title} onChange={(e) => setTitle(e.target.value)} />
          </div>

          <div className="space-y-2">
            <Label htmlFor="course-description">Description</Label>
            <Textarea id="course-description" rows={3} value={description} onChange={(e) => setDescription(e.target.value)} />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label htmlFor="course-category">Category</Label>
              <Input id="course-category" value={category} onChange={(e) => setCategory(e.target.value)} />
            </div>

            <div className="space-y-2">
              <Label htmlFor="course-level">Level</Label>
              <Select value={level} onValueChange={(v) => setLevel(v as typeof level)}>
                <SelectTrigger id="course-level"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="beginner">Beginner</SelectItem>
                  <SelectItem value="intermediate">Intermediate</SelectItem>
                  <SelectItem value="advanced">Advanced</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="course-duration">Duration (hours)</Label>
              <Input id="course-duration" type="number" min={1} value={duration} onChange={(e) => setDuration(e.target.value)} />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="course-instructor-id">Assigned instructor</Label>
              <Select value={instructorId} onValueChange={pickInstructor}>
                <SelectTrigger id="course-instructor-id">
                  <SelectValue placeholder="Select an instructor" />
                </SelectTrigger>
                <SelectContent>
                  {instructors.length === 0 && (
                    <div className="px-2 py-1.5 text-sm text-muted-foreground">No active instructor accounts</div>
                  )}
                  {instructors.map((i) => (
                    <SelectItem key={i.id} value={i.id}>{i.name} — {i.email}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">Grants that account upload rights for this course&apos;s modules.</p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="course-instructor-name">Instructor display name</Label>
              <Input id="course-instructor-name" value={instructorName} onChange={(e) => setInstructorName(e.target.value)} />
              <p className="text-xs text-muted-foreground">Shown on the course card. Auto-filled from the selection above; editable for instructors without a platform account.</p>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="course-thumbnail">Thumbnail path</Label>
            <Input id="course-thumbnail" value={thumbnail} onChange={(e) => setThumbnail(e.target.value)} />
          </div>

          {/* target_audience — text[] */}
          <div className="space-y-2">
            <Label htmlFor="course-audience">Target audience</Label>
            <Input
              id="course-audience"
              placeholder="Type and press Enter to add"
              value={audienceInput}
              onChange={(e) => setAudienceInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault()
                  addTag(audienceInput, audience, setAudience, () => setAudienceInput(""))
                }
              }}
            />
            {audience.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {audience.map((a) => (
                  <Badge key={a} variant="secondary" className="gap-1">
                    {a}
                    <button type="button" onClick={() => setAudience(audience.filter((x) => x !== a))} aria-label={`Remove ${a}`}>
                      <X className="w-3 h-3" />
                    </button>
                  </Badge>
                ))}
              </div>
            )}
          </div>

          {/* prerequisites — text[], matched by title against live courses */}
          <div className="space-y-2">
            <Label htmlFor="course-prereqs">Prerequisites</Label>
            <div className="relative">
              <Input
                id="course-prereqs"
                placeholder="Type a course title and press Enter to add"
                value={prereqInput}
                onChange={(e) => setPrereqInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault()
                    addTag(prereqInput, prereqs, setPrereqs, () => { setPrereqInput(""); setSuggestions([]) })
                  }
                }}
              />
              {prereqExactMatch && <Check className="absolute right-3 top-2.5 w-4 h-4 text-green-600" />}
            </div>

            {prereqExactMatch && (
              <p className="text-xs text-green-600">Matches an existing course — this prerequisite will be enforced.</p>
            )}

            {!prereqExactMatch && suggestions.length > 0 && (
              <div className="text-xs text-muted-foreground space-x-1">
                <span>Did you mean:</span>
                {suggestions.map((s) => (
                  <button key={s.id} type="button" className="underline underline-offset-2 hover:text-foreground"
                    onClick={() => { setPrereqInput(s.title); setSuggestions([]) }}>
                    {s.title}
                  </button>
                ))}
              </div>
            )}

            {prereqs.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {prereqs.map((p) => {
                  const matched = activeTitles.some((t) => norm(t) === norm(p))
                  return (
                    <Badge key={p} variant={matched ? "default" : "outline"} className="gap-1">
                      {matched && <Check className="w-3 h-3" />}
                      {p}
                      <button type="button" onClick={() => setPrereqs(prereqs.filter((x) => x !== p))} aria-label={`Remove ${p}`}>
                        <X className="w-3 h-3" />
                      </button>
                    </Badge>
                  )
                })}
              </div>
            )}

            <p className="text-xs text-muted-foreground flex gap-2">
              <Info className="w-4 h-4 shrink-0 mt-0.5" />
              <span>
                A prerequisite only locks a course if the text matches an existing course&apos;s title
                exactly (capitalisation and extra spaces are ignored). Text that matches nothing is
                saved but has no effect, which is fine — if a course with that exact title is uploaded
                later, the lock starts applying on its own, including to people already enrolled.
              </span>
            </p>
          </div>

          <div className="flex items-center gap-3">
            <Switch id="course-active" checked={isActive} onCheckedChange={setIsActive} />
            <Label htmlFor="course-active">Active (visible to learners)</Label>
          </div>

          {error && <p className="text-sm text-destructive">{error}</p>}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>Cancel</Button>
          <Button onClick={handleSubmit} disabled={saving}>
            {saving ? "Saving..." : isEdit ? "Save Changes" : "Create Course"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

/** Thin wrapper: the "Create Course" button that opens a fresh CourseFormDialog. */
export function CreateCourseForm({ onSaved }: { onSaved?: () => void }) {
  const [open, setOpen] = useState(false)
  return (
    <>
      <Button className="gap-2" onClick={() => setOpen(true)}>
        <Plus className="w-4 h-4" />
        Create Course
      </Button>
      <CourseFormDialog open={open} onOpenChange={setOpen} onSaved={onSaved} />
    </>
  )
}
