"use client"

import { useCallback, useEffect, useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Target, Plus, Pencil, Trash2, Loader2 } from "lucide-react"
import { supabaseBrowser } from "@/lib/supabase/browser-client"
import { recordAdminAction } from "@/lib/admin/log-client"
import {
  LearningPathFormDialog,
  type EditableLearningPath,
} from "@/components/admin/learning-path-form-dialog"

type PathRow = {
  id: string
  title: string
  description: string
  target_audience: string[] | null
  status: "active" | "archived"
  learningpath_courses: { course_id: string; course_order: number; courses: { title: string } | null }[]
}

/**
 * Admin CRUD for learning paths.
 * Reads every path (learningpaths_public_read admits admins to archived rows).
 * The join column is `learningpath_id` — see migration 006 naming drift.
 */
export function LearningPathsManagementView() {
  const [paths, setPaths] = useState<PathRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editing, setEditing] = useState<EditableLearningPath | null>(null)
  const [confirmId, setConfirmId] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    const { data, error: loadErr } = await supabaseBrowser
      .from("learningpaths")
      .select(
        "id,title,description,target_audience,status,learningpath_courses(course_id,course_order,courses(title))"
      )
      .order("title")
    if (loadErr) setError(loadErr.message)
    setPaths((data ?? []) as unknown as PathRow[])
    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])

  const remove = async (p: PathRow) => {
    setError(null)
    const { error: linkErr } = await supabaseBrowser
      .from("learningpath_courses")
      .delete()
      .eq("learningpath_id", p.id)
    if (linkErr) { setError(linkErr.message); return }

    const { error: delErr } = await supabaseBrowser.from("learningpaths").delete().eq("id", p.id)
    if (delErr) { setError(delErr.message); return }

    recordAdminAction("learningpath_deleted", p.id, { message: `Learning path deleted: ${p.title}` })
    setConfirmId(null)
    load()
  }

  const toEditable = (p: PathRow): EditableLearningPath => ({
    id: p.id,
    title: p.title,
    description: p.description,
    target_audience: p.target_audience,
    status: p.status,
    courses: (p.learningpath_courses ?? []).map((lc) => ({
      course_id: lc.course_id,
      course_order: lc.course_order,
    })),
  })

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Learning Paths</h1>
          <p className="text-muted-foreground">Ordered sequences of existing courses</p>
        </div>
        <Button onClick={() => { setEditing(null); setDialogOpen(true) }} className="gap-2">
          <Plus className="h-4 w-4" /> Create Learning Path
        </Button>
      </div>

      {error && <p className="text-sm text-destructive">{error}</p>}

      {loading ? (
        <div className="text-center"><Loader2 className="mx-auto h-8 w-8 animate-spin" /></div>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Target className="h-5 w-5" />
              Learning paths
            </CardTitle>
            <CardDescription>{paths.length} defined</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {paths.length === 0 ? (
              <p className="py-6 text-center text-muted-foreground">
                No learning paths yet. Create one to group existing courses into a sequence.
              </p>
            ) : (
              paths.map((p) => {
                const ordered = [...(p.learningpath_courses ?? [])].sort(
                  (a, b) => a.course_order - b.course_order
                )
                return (
                  <div key={p.id} className="flex items-start gap-4 rounded-lg border p-4">
                    <div className="flex-1 space-y-2">
                      <div className="flex flex-wrap items-center gap-2">
                        <h4 className="font-medium">{p.title}</h4>
                        <Badge variant={p.status === "active" ? "outline" : "secondary"} className="text-xs">
                          {p.status}
                        </Badge>
                        {(p.target_audience ?? []).map((a) => (
                          <Badge key={a} variant="secondary" className="text-xs">{a}</Badge>
                        ))}
                      </div>
                      <p className="text-sm text-muted-foreground">{p.description}</p>
                      <ol className="ml-4 list-decimal text-xs text-muted-foreground">
                        {ordered.map((lc) => (
                          <li key={lc.course_id}>{lc.courses?.title ?? lc.course_id}</li>
                        ))}
                      </ol>
                    </div>
                    <div className="flex shrink-0 gap-2">
                      <Button
                        variant="outline" size="sm"
                        aria-label={`Edit ${p.title}`}
                        onClick={() => { setEditing(toEditable(p)); setDialogOpen(true) }}
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                      {confirmId === p.id ? (
                        <>
                          <Button size="sm" variant="destructive" onClick={() => remove(p)}>Confirm</Button>
                          <Button size="sm" variant="outline" onClick={() => setConfirmId(null)}>Cancel</Button>
                        </>
                      ) : (
                        <Button
                          variant="outline" size="sm"
                          aria-label={`Delete ${p.title}`}
                          onClick={() => setConfirmId(p.id)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                  </div>
                )
              })
            )}
          </CardContent>
        </Card>
      )}

      <LearningPathFormDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        path={editing}
        onSaved={() => { setDialogOpen(false); load() }}
      />
    </div>
  )
}
