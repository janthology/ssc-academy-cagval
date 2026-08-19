"use client"

import { useCallback, useEffect, useState } from "react"
import { supabaseBrowser } from "@/lib/supabase/browser-client"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Switch } from "@/components/ui/switch"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription,
  AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { FolderInput, FileText, Loader2, AlertTriangle } from "lucide-react"
import { recordAdminAction } from "@/lib/admin/log-client"

type OrphanModule = { id: string; title: string; created_by: string | null; creatorName: string }
type Course = { id: string; title: string; instructor_id: string | null; ownerName: string }

export function AssignModulesView() {
  const [modules, setModules] = useState<OrphanModule[]>([])
  const [courses, setCourses] = useState<Course[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true); setError(null)
    try {
      // Published AND unassigned modules are the only ones eligible for assignment.
      const { data: mods, error: mErr } = await supabaseBrowser
        .from("modules")
        .select("id, title, created_by")
        .eq("status", "published")
        .is("course_id", null)
        .order("title")
      if (mErr) throw new Error(mErr.message)

      const { data: courseRows, error: cErr } = await supabaseBrowser
        .from("courses")
        .select("id, title, instructor_id")
        .order("title")
      if (cErr) throw new Error(cErr.message)

      const ids = [
        ...new Set([
          ...(mods ?? []).map((m: any) => m.created_by).filter(Boolean),
          ...(courseRows ?? []).map((c: any) => c.instructor_id).filter(Boolean),
        ]),
      ]
      const { data: users } = ids.length
        ? await supabaseBrowser.from("users").select("id, name").in("id", ids)
        : { data: [] as any[] }
      const nameOf = Object.fromEntries((users ?? []).map((u: any) => [u.id, u.name]))

      setModules((mods ?? []).map((m: any) => ({ ...m, creatorName: nameOf[m.created_by] ?? "Unknown" })))
      setCourses((courseRows ?? []).map((c: any) => ({ ...c, ownerName: c.instructor_id ? (nameOf[c.instructor_id] ?? "Unknown") : "no assigned instructor" })))
    } catch (err: any) {
      setError(err.message || "Failed to load modules.")
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  if (loading) {
    return (
      <div className="space-y-6">
        <h1 className="text-3xl font-bold text-foreground font-serif">Assign Modules</h1>
        <div className="flex justify-center p-10"><Loader2 className="w-8 h-8 animate-spin" /></div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-foreground font-serif">Assign Modules</h1>
        <p className="text-muted-foreground">
          Published modules not yet attached to a course. By default a module can only go to a
          course owned by its creator; use Override to assign anyway.
        </p>
      </div>

      {error && <p className="text-sm text-destructive">{error}</p>}

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><FolderInput className="w-5 h-5" />Awaiting Assignment</CardTitle>
          <CardDescription>Published, unassigned modules.</CardDescription>
        </CardHeader>
        <CardContent>
          {modules.length === 0 ? (
            <p className="text-sm text-muted-foreground">No modules awaiting assignment.</p>
          ) : (
            <div className="space-y-4">
              {modules.map((m) => (
                <AssignRow key={m.id} module={m} courses={courses} onAssigned={load} />
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

function AssignRow({ module: mod, courses, onAssigned }: { module: OrphanModule; courses: Course[]; onAssigned: () => void }) {
  const [selected, setSelected] = useState<string>("")
  const [override, setOverride] = useState(false)
  const [reason, setReason] = useState("")
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [working, setWorking] = useState(false)
  const [rowError, setRowError] = useState<string | null>(null)

  const matches = (c: Course) => c.instructor_id != null && c.instructor_id === mod.created_by
  const selectedCourse = courses.find((c) => c.id === selected) || null
  const needsOverride = !!selectedCourse && !matches(selectedCourse)

  const doAssign = async (withReason: string | null) => {
    if (!selectedCourse) return
    setWorking(true); setRowError(null)
    try {
      const { error } = await supabaseBrowser.from("modules").update({ course_id: selectedCourse.id }).eq("id", mod.id)
      if (error) throw new Error(error.message)

      const base = { moduleId: mod.id, moduleTitle: mod.title, creatorId: mod.created_by, creatorName: mod.creatorName, courseId: selectedCourse.id, courseTitle: selectedCourse.title, courseOwnerId: selectedCourse.instructor_id, courseOwnerName: selectedCourse.ownerName }
      if (withReason !== null) {
        recordAdminAction("module_assigned_override", mod.id, {
          ...base, reason: withReason,
          message: `Module "${mod.title}" assigned to "${selectedCourse.title}" by OVERRIDE (created by ${mod.creatorName}, course belongs to ${selectedCourse.ownerName})${withReason ? ` — reason: ${withReason}` : ""}`,
        })
      } else {
        recordAdminAction("module_assigned", mod.id, {
          ...base,
          message: `Module "${mod.title}" assigned to "${selectedCourse.title}"`,
        })
      }
      // Public course pages change; drop the cache for the target course.
      fetch("/api/revalidate", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ path: `/courses/${selectedCourse.id}` }) }).catch(() => {})
      setConfirmOpen(false)
      onAssigned()
    } catch (err: any) {
      setRowError(err.message || "Failed to assign.")
    } finally {
      setWorking(false)
    }
  }

  const onAssignClick = () => {
    if (!selectedCourse) return
    if (needsOverride) setConfirmOpen(true)  // override path: confirm + reason
    else doAssign(null)                       // strict match
  }

  return (
    <div className="p-4 border rounded-lg space-y-3">
      <div className="flex items-center gap-2">
        <FileText className="w-4 h-4 text-muted-foreground shrink-0" />
        <span className="font-medium">{mod.title}</span>
        <Badge variant="outline">Published</Badge>
        <span className="text-sm text-muted-foreground">created by {mod.creatorName}</span>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <Select value={selected} onValueChange={setSelected}>
          <SelectTrigger className="w-[22rem]"><SelectValue placeholder="Select a course to assign to" /></SelectTrigger>
          <SelectContent>
            {courses.map((c) => {
              const ok = matches(c)
              return (
                <SelectItem key={c.id} value={c.id} disabled={!ok && !override}>
                  {c.title}
                  {!ok && ` — belongs to ${c.ownerName}`}
                </SelectItem>
              )
            })}
          </SelectContent>
        </Select>

        <div className="flex items-center gap-2">
          <Switch id={`ov-${mod.id}`} checked={override} onCheckedChange={(v) => { setOverride(v); if (!v && needsOverride) setSelected("") }} />
          <Label htmlFor={`ov-${mod.id}`} className="text-sm">Override</Label>
        </div>

        <Button size="sm" disabled={!selected || working} onClick={onAssignClick}>
          {working ? "Assigning..." : "Assign"}
        </Button>
      </div>

      {selectedCourse && !matches(selectedCourse) && (
        <p className="text-xs text-amber-700 flex items-center gap-1">
          <AlertTriangle className="w-3 h-3" />
          This course belongs to {selectedCourse.ownerName}, not the module&apos;s creator ({mod.creatorName}). Assigning requires Override.
        </p>
      )}
      {rowError && <p className="text-sm text-destructive">{rowError}</p>}

      <AlertDialog open={confirmOpen} onOpenChange={(o) => { if (!o) setConfirmOpen(false) }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Override assignment?</AlertDialogTitle>
            <AlertDialogDescription>
              &ldquo;{mod.title}&rdquo; was created by <strong>{mod.creatorName}</strong>, but
              &ldquo;{selectedCourse?.title}&rdquo; belongs to <strong>{selectedCourse?.ownerName}</strong>.
              This override will be recorded in the admin activity log.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="space-y-2">
            <Label htmlFor={`reason-${mod.id}`}>Reason (optional)</Label>
            <Textarea id={`reason-${mod.id}`} rows={2} value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Why is this override needed?" />
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={working}>Cancel</AlertDialogCancel>
            <AlertDialogAction disabled={working} onClick={(e) => { e.preventDefault(); doAssign(reason.trim()) }}>
              {working ? "Assigning..." : "Assign anyway"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
