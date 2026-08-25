"use client"

import { useCallback, useEffect, useState } from "react"
import Link from "next/link"
import { useParams } from "next/navigation"
import { supabaseBrowser } from "@/lib/supabase/browser-client"
import { useUser } from "@/components/providers/user-provider"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { ArrowLeft, Loader2, Users } from "lucide-react"

type RosterRow = {
  id: string
  user_id: string
  status: string
  progress: number
  enrolled_at: string
  completed_at: string | null
  last_accessed_at: string | null
  grade: number | null
  learnerName: string
  learnerEmail: string
}

export function InstructorCourseRoster() {
  const { courseId } = useParams<{ courseId: string }>()
  const { profile, loading: userLoading } = useUser()
  const [courseTitle, setCourseTitle] = useState<string>("")
  const [rows, setRows] = useState<RosterRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    if (!courseId || !profile?.id) return
    setLoading(true)
    setError(null)
    try {
      const { data: course, error: cErr } = await supabaseBrowser
        .from("courses")
        .select("id, title, instructor_id")
        .eq("id", courseId)
        .eq("instructor_id", profile.id)
        .maybeSingle()
      if (cErr) throw new Error(cErr.message)
      if (!course) throw new Error("Course not found or you are not the assigned instructor.")

      setCourseTitle(course.title)

      const { data: enrollments, error: eErr } = await supabaseBrowser
        .from("enrollments")
        .select("id, user_id, status, progress, enrolled_at, completed_at, last_accessed_at, grade, user:users(name, email)")
        .eq("course_id", courseId)
        .order("enrolled_at", { ascending: true })
      if (eErr) throw new Error(eErr.message)

      setRows(
        (enrollments ?? []).map((e: any) => {
          const u = Array.isArray(e.user) ? e.user[0] : e.user
          return {
            id: e.id,
            user_id: e.user_id,
            status: e.status,
            progress: e.progress ?? 0,
            enrolled_at: e.enrolled_at,
            completed_at: e.completed_at,
            last_accessed_at: e.last_accessed_at,
            grade: e.grade,
            learnerName: u?.name ?? "Unknown learner",
            learnerEmail: u?.email ?? "",
          }
        })
      )
    } catch (err: any) {
      setError(err.message || "Failed to load roster.")
    } finally {
      setLoading(false)
    }
  }, [courseId, profile?.id])

  useEffect(() => {
    if (userLoading) return
    load()
  }, [userLoading, load])

  if (userLoading || loading) {
    return (
      <div className="flex justify-center p-10">
        <Loader2 className="w-8 h-8 animate-spin" />
      </div>
    )
  }

  if (error) {
    return (
      <div className="space-y-4">
        <p className="text-red-600">{error}</p>
        <Button variant="outline" asChild>
          <Link href="/instructor">
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to courses
          </Link>
        </Button>
      </div>
    )
  }

  const completed = rows.filter((r) => r.status === "completed" || r.progress >= 100).length
  const active = rows.filter((r) => r.status === "active" && r.progress < 100).length

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <Button variant="ghost" size="sm" className="mb-2 -ml-2 gap-2" asChild>
            <Link href="/instructor">
              <ArrowLeft className="w-4 h-4" />
              My courses
            </Link>
          </Button>
          <h1 className="text-3xl font-bold text-foreground font-serif">Learner roster</h1>
          <p className="text-muted-foreground">{courseTitle}</p>
        </div>
        <div className="flex gap-2 text-sm">
          <Badge variant="secondary">{rows.length} enrolled</Badge>
          <Badge variant="outline">{active} in progress</Badge>
          <Badge>{completed} completed</Badge>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="w-5 h-5" />
            Learners
          </CardTitle>
          <CardDescription>Enrollment and progress for your course. Read-only.</CardDescription>
        </CardHeader>
        <CardContent>
          {rows.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">No learners enrolled yet.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left text-muted-foreground">
                    <th className="py-2 pr-4 font-medium">Learner</th>
                    <th className="py-2 pr-4 font-medium">Status</th>
                    <th className="py-2 pr-4 font-medium">Progress</th>
                    <th className="py-2 pr-4 font-medium">Enrolled</th>
                    <th className="py-2 font-medium">Last access</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r) => (
                    <tr key={r.id} className="border-b last:border-0">
                      <td className="py-3 pr-4">
                        <p className="font-medium">{r.learnerName}</p>
                        <p className="text-xs text-muted-foreground">{r.learnerEmail}</p>
                      </td>
                      <td className="py-3 pr-4">
                        <Badge variant={r.status === "completed" ? "default" : "secondary"}>
                          {r.status}
                        </Badge>
                      </td>
                      <td className="py-3 pr-4">
                        <div className="flex items-center gap-2 min-w-[8rem]">
                          <div className="h-2 flex-1 rounded-full bg-muted overflow-hidden">
                            <div
                              className="h-full bg-primary"
                              style={{ width: `${Math.min(100, Math.max(0, r.progress))}%` }}
                            />
                          </div>
                          <span className="tabular-nums text-xs w-8">{r.progress}%</span>
                        </div>
                      </td>
                      <td className="py-3 pr-4 text-muted-foreground whitespace-nowrap">
                        {new Date(r.enrolled_at).toLocaleDateString("en-US", {
                          year: "numeric",
                          month: "short",
                          day: "numeric",
                        })}
                      </td>
                      <td className="py-3 text-muted-foreground whitespace-nowrap">
                        {r.last_accessed_at
                          ? new Date(r.last_accessed_at).toLocaleDateString("en-US", {
                              year: "numeric",
                              month: "short",
                              day: "numeric",
                            })
                          : "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
