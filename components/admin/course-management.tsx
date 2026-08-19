"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { supabaseBrowser } from "@/lib/supabase/browser-client"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { BookOpen, Search, MoreHorizontal, Users, Clock, Star, Edit, Eye, Power, PowerOff, Loader2 } from "lucide-react"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription,
  AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import Link from "next/link"
import { CreateCourseForm, CourseFormDialog, type EditableCourse } from "@/components/admin/create-course-form"
import { recordAdminAction } from "@/lib/admin/log-client"

type CourseRow = EditableCourse & {
  rating: number | null
  enrollment_count: number | null
  moduleCount: number
  completedCount: number
}

function revalidateCatalog() {
  fetch("/api/revalidate", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ path: "/courses" }),
  }).catch(() => {})
}

export function CourseManagement() {
  const [courses, setCourses] = useState<CourseRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [search, setSearch] = useState("")

  const [editing, setEditing] = useState<CourseRow | null>(null)
  const [editOpen, setEditOpen] = useState(false)
  const [pendingToggle, setPendingToggle] = useState<CourseRow | null>(null)
  const [working, setWorking] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      // Admin sees ALL courses (courses_public_read allows is_admin), unlike the
      // public catalog which is is_active-only.
      const { data, error: qErr } = await supabaseBrowser
        .from("courses")
        .select(
          "id, title, description, category, level, duration, target_audience, prerequisites, thumbnail, instructor, instructor_id, is_active, rating, enrollment_count, modules(count)"
        )
        .order("title")
      if (qErr) throw new Error(qErr.message)

      // Completed-enrollment counts per course (one small query, grouped client-side).
      const { data: enr } = await supabaseBrowser
        .from("enrollments")
        .select("course_id, status")
      const completedByCourse: Record<string, number> = {}
      for (const e of enr ?? []) {
        if (e.status === "completed") completedByCourse[e.course_id] = (completedByCourse[e.course_id] || 0) + 1
      }

      setCourses(
        (data ?? []).map((c: any) => ({
          ...c,
          moduleCount: Array.isArray(c.modules) && c.modules[0] ? c.modules[0].count : 0,
          completedCount: completedByCourse[c.id] ?? 0,
        }))
      )
    } catch (err: any) {
      setError(err.message || "Failed to load courses.")
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  const stats = useMemo(() => {
    const total = courses.length
    const active = courses.filter((c) => c.is_active).length
    const inactive = total - active
    const totalEnrollments = courses.reduce((s, c) => s + (c.enrollment_count || 0), 0)
    return { total, active, inactive, totalEnrollments }
  }, [courses])

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return courses
    return courses.filter((c) =>
      c.title.toLowerCase().includes(q) ||
      c.category.toLowerCase().includes(q) ||
      c.instructor.toLowerCase().includes(q)
    )
  }, [courses, search])

  const activeCourses = filtered.filter((c) => c.is_active)
  const inactiveCourses = filtered.filter((c) => !c.is_active)

  const toggleActive = async (course: CourseRow, next: boolean) => {
    setWorking(true)
    try {
      const { error: uErr } = await supabaseBrowser
        .from("courses")
        .update({ is_active: next })
        .eq("id", course.id)
      if (uErr) throw new Error(uErr.message)
      recordAdminAction(next ? "course_reactivated" : "course_deactivated", course.id, {
        message: `Course ${next ? "reactivated" : "deactivated"}: ${course.title}`,
      })
      revalidateCatalog()
      setCourses((prev) => prev.map((c) => (c.id === course.id ? { ...c, is_active: next } : c)))
    } catch (err: any) {
      setError(err.message || "Failed to update course status.")
    } finally {
      setWorking(false)
      setPendingToggle(null)
    }
  }

  const statCards = [
    { label: "Total Courses", value: stats.total },
    { label: "Active", value: stats.active },
    { label: "Inactive", value: stats.inactive },
    { label: "Total Enrollments", value: stats.totalEnrollments.toLocaleString() },
  ]

  const CourseItem = ({ course }: { course: CourseRow }) => (
    <div className="flex items-center gap-4 p-4 border rounded-lg">
      <div className="w-16 h-16 bg-muted rounded-lg flex items-center justify-center">
        <BookOpen className="w-6 h-6 text-primary" />
      </div>

      <div className="flex-1 space-y-2">
        <div className="flex items-center gap-2 flex-wrap">
          <h4 className="font-semibold text-lg">{course.title}</h4>
          <Badge variant={course.is_active ? "default" : "secondary"}>
            {course.is_active ? "Active" : "Inactive"}
          </Badge>
          <Badge variant="outline" className="capitalize">{course.level}</Badge>
        </div>

        <div className="flex items-center gap-4 text-sm text-muted-foreground flex-wrap">
          <span>by {course.instructor}</span>
          <span>{course.category}</span>
          <div className="flex items-center gap-1"><Clock className="w-3 h-3" />{course.duration} hours</div>
          <span>{course.moduleCount} modules</span>
        </div>

        <div className="flex items-center gap-6 text-sm flex-wrap">
          <div className="flex items-center gap-1">
            <Users className="w-4 h-4 text-primary" />
            <span>{(course.enrollment_count ?? 0).toLocaleString()} enrolled</span>
          </div>
          <span>{course.completedCount.toLocaleString()} completed</span>
          {course.rating !== null && course.rating > 0 && (
            <div className="flex items-center gap-1">
              <Star className="w-4 h-4 fill-yellow-400 text-yellow-400" />
              <span>{course.rating}</span>
            </div>
          )}
        </div>
      </div>

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="sm"><MoreHorizontal className="w-4 h-4" /></Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem asChild>
            <Link href={`/courses/${course.id}`}><Eye className="w-4 h-4 mr-2" />View Course</Link>
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => { setEditing(course); setEditOpen(true) }}>
            <Edit className="w-4 h-4 mr-2" />Edit Course
          </DropdownMenuItem>
          {course.is_active ? (
            <DropdownMenuItem className="text-destructive" onClick={() => setPendingToggle(course)}>
              <PowerOff className="w-4 h-4 mr-2" />Deactivate
            </DropdownMenuItem>
          ) : (
            <DropdownMenuItem onClick={() => toggleActive(course, true)}>
              <Power className="w-4 h-4 mr-2" />Reactivate
            </DropdownMenuItem>
          )}
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  )

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground font-serif">Course Management</h1>
          <p className="text-muted-foreground">Create and manage learning content</p>
        </div>
        <CreateCourseForm onSaved={load} />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {statCards.map((stat) => (
          <Card key={stat.label}>
            <CardContent className="p-4">
              <div className="text-center">
                <div className="text-2xl font-bold">{loading ? "—" : stat.value}</div>
                <div className="text-sm text-muted-foreground">{stat.label}</div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {error && <p className="text-sm text-destructive">{error}</p>}

      <Tabs defaultValue="all" className="w-full">
        <div className="flex items-center justify-between mb-4 gap-4 flex-wrap">
          <TabsList>
            <TabsTrigger value="all">All Courses ({filtered.length})</TabsTrigger>
            <TabsTrigger value="active">Active ({activeCourses.length})</TabsTrigger>
            <TabsTrigger value="inactive">Inactive ({inactiveCourses.length})</TabsTrigger>
          </TabsList>

          <div className="relative">
            <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
            <Input placeholder="Search courses..." className="pl-10 w-64" value={search} onChange={(e) => setSearch(e.target.value)} />
          </div>
        </div>

        {loading ? (
          <div className="flex justify-center p-10"><Loader2 className="w-8 h-8 animate-spin" /></div>
        ) : (
          <>
            <TabsContent value="all">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2"><BookOpen className="w-5 h-5" />All Courses</CardTitle>
                  <CardDescription>Every course, active or not (admins see all).</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {filtered.length === 0 && <p className="text-sm text-muted-foreground">No courses found.</p>}
                    {filtered.map((c) => <CourseItem key={c.id} course={c} />)}
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="active">
              <Card>
                <CardHeader><CardTitle>Active Courses</CardTitle><CardDescription>Visible in the public catalog and open for enrollment.</CardDescription></CardHeader>
                <CardContent><div className="space-y-4">
                  {activeCourses.length === 0 && <p className="text-sm text-muted-foreground">No active courses.</p>}
                  {activeCourses.map((c) => <CourseItem key={c.id} course={c} />)}
                </div></CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="inactive">
              <Card>
                <CardHeader><CardTitle>Inactive Courses</CardTitle><CardDescription>Hidden from the catalog and closed to new enrollment. Existing enrollments and certificates are untouched.</CardDescription></CardHeader>
                <CardContent><div className="space-y-4">
                  {inactiveCourses.length === 0 && <p className="text-sm text-muted-foreground">No inactive courses.</p>}
                  {inactiveCourses.map((c) => <CourseItem key={c.id} course={c} />)}
                </div></CardContent>
              </Card>
            </TabsContent>
          </>
        )}
      </Tabs>

      {/* Edit dialog (shared with Create) */}
      <CourseFormDialog course={editing} open={editOpen} onOpenChange={setEditOpen} onSaved={load} />

      {/* Deactivate confirmation */}
      <AlertDialog open={!!pendingToggle} onOpenChange={(o) => { if (!o) setPendingToggle(null) }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Deactivate this course?</AlertDialogTitle>
            <AlertDialogDescription>
              &ldquo;{pendingToggle?.title}&rdquo; will be <strong>hidden from the public catalog and closed to new
              enrollment immediately</strong>. Nothing is deleted — existing enrollments, progress and certificates
              are kept, and you can reactivate it at any time.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={working}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              disabled={working}
              onClick={(e) => { e.preventDefault(); if (pendingToggle) toggleActive(pendingToggle, false) }}
            >
              {working ? "Deactivating..." : "Deactivate"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
