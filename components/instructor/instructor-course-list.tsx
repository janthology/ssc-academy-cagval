"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { supabaseBrowser } from "@/lib/supabase/browser-client"
import { useUser } from "@/components/providers/user-provider"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { BookOpen, Plus, FileText } from "lucide-react"

type ModuleRow = {
  id: string
  title: string
  status: string
  order: number
  submitted_at: string | null
  review_notes: string | null
}
type CourseRow = {
  id: string
  title: string
  category: string
  is_active: boolean
  modules: ModuleRow[]
}

const STATUS_VARIANT: Record<string, "default" | "secondary" | "outline" | "destructive"> = {
  published: "default",
  pending_review: "secondary",
  draft: "outline",
  rejected: "destructive",
}
const STATUS_LABEL: Record<string, string> = {
  published: "Published",
  pending_review: "In review",
  draft: "Draft",
  rejected: "Rejected",
}

export function InstructorCourseList() {
  const { profile, loading: userLoading } = useUser()
  const [courses, setCourses] = useState<CourseRow[]>([])
  const [orphans, setOrphans] = useState<ModuleRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (userLoading) return
    const userId = profile?.id
    if (!userId) {
      setLoading(false)
      return
    }

    const load = async () => {
      try {
        // Ownership filter is explicit here as well as enforced by RLS —
        // courses_public_read exposes every active course, so the scoping to
        // "my courses" has to come from this query. The id comes from the shared
        // user context (no per-component getUser()).
        const { data, error: queryError } = await supabaseBrowser
          .from("courses")
          .select("id, title, category, is_active, modules(id, title, status, order, submitted_at, review_notes)")
          .eq("instructor_id", userId)
          .order("title")
        if (queryError) throw new Error(queryError.message)

        setCourses(
          (data ?? []).map((c: any) => ({
            ...c,
            modules: (c.modules ?? []).sort((a: ModuleRow, b: ModuleRow) => a.order - b.order),
          }))
        )

        // Standalone (orphan) modules this instructor created, not yet assigned
        // to any course. Visible via modules_public_read's created_by branch (013).
        const { data: orphanData } = await supabaseBrowser
          .from("modules")
          .select("id, title, status, order, submitted_at, review_notes")
          .eq("created_by", userId)
          .is("course_id", null)
          .order("title")
        setOrphans((orphanData ?? []) as ModuleRow[])
      } catch (err: any) {
        setError(err.message || "Failed to load your courses.")
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [profile?.id, userLoading])

  if (loading) return <div className="text-center p-6">Loading...</div>
  if (error) return <div className="text-center p-6 text-red-600">{error}</div>

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-foreground">My Courses</h2>
          <p className="text-muted-foreground">Courses you are assigned to as instructor.</p>
        </div>
        <Button asChild size="sm" variant="outline" className="gap-2 shrink-0">
          <Link href="/instructor/modules/new">
            <Plus className="w-4 h-4" />
            New standalone module
          </Link>
        </Button>
      </div>

      {/* Standalone modules — created without a course, awaiting admin assignment. */}
      {orphans.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileText className="w-5 h-5" />
              Standalone modules
            </CardTitle>
            <CardDescription>
              Not assigned to a course yet. An administrator assigns published ones to a course.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {orphans.map((m) => (
                <div key={m.id} className="flex items-center gap-3 p-3 border rounded-lg">
                  <FileText className="w-4 h-4 text-muted-foreground shrink-0" />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-medium truncate">{m.title}</span>
                      <Badge variant={STATUS_VARIANT[m.status] ?? "outline"}>
                        {STATUS_LABEL[m.status] ?? m.status}
                      </Badge>
                      <Badge variant="outline">Unassigned</Badge>
                    </div>
                    {m.status === "rejected" && m.review_notes && (
                      <p className="text-xs text-destructive mt-1">Reviewer notes: {m.review_notes}</p>
                    )}
                  </div>
                  <Button asChild size="sm" variant="outline">
                    <Link href={`/instructor/modules/${m.id}`}>
                      {m.status === "draft" || m.status === "rejected" ? "Edit" : "View"}
                    </Link>
                  </Button>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {courses.length === 0 && (
        <Card>
          <CardHeader>
            <CardTitle>No courses assigned</CardTitle>
            <CardDescription>
              An administrator assigns courses to your account. Once assigned, they appear
              here and you can add modules.
            </CardDescription>
          </CardHeader>
        </Card>
      )}

      {courses.map((course) => (
        <Card key={course.id}>
          <CardHeader>
            <div className="flex items-start justify-between gap-4">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <BookOpen className="w-5 h-5" />
                  {course.title}
                </CardTitle>
                <CardDescription>
                  {course.category}
                  {!course.is_active && " — course is inactive"}
                </CardDescription>
              </div>
              <Button asChild size="sm" className="gap-2 shrink-0">
                <Link href={`/instructor/courses/${course.id}/modules/new`}>
                  <Plus className="w-4 h-4" />
                  New Module
                </Link>
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {course.modules.length === 0 ? (
              <p className="text-sm text-muted-foreground">No modules yet.</p>
            ) : (
              <div className="space-y-2">
                {course.modules.map((m) => (
                  <div key={m.id} className="flex items-center gap-3 p-3 border rounded-lg">
                    <FileText className="w-4 h-4 text-muted-foreground shrink-0" />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-medium truncate">{m.title}</span>
                        <Badge variant={STATUS_VARIANT[m.status] ?? "outline"}>
                          {STATUS_LABEL[m.status] ?? m.status}
                        </Badge>
                      </div>
                      {m.status === "rejected" && m.review_notes && (
                        <p className="text-xs text-destructive mt-1">
                          Reviewer notes: {m.review_notes}
                        </p>
                      )}
                    </div>
                    <Button asChild size="sm" variant="outline">
                      <Link href={`/instructor/courses/${course.id}/modules/${m.id}`}>
                        {m.status === "draft" || m.status === "rejected" ? "Edit" : "View"}
                      </Link>
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      ))}
    </div>
  )
}
