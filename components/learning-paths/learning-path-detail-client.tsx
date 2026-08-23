"use client"

import { useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { Header } from "@/components/ui/header"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Progress } from "@/components/ui/progress"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { AlertCircle, ArrowLeft, BookOpen, CheckCircle2, Clock, Loader2 } from "lucide-react"
import { supabaseBrowser } from "@/lib/supabase/browser-client"
import { enrollInCourse } from "@/lib/courses/enroll"
import type { LearningPathWithProgress } from "@/lib/learning-paths/public-paths"

type CourseStatus = {
  enrolled: boolean
  progress: number
}

export function LearningPathDetailClient({
  path: initialPath,
}: {
  path: LearningPathWithProgress
}) {
  const router = useRouter()
  const [path, setPath] = useState(initialPath)
  const [courseStatus, setCourseStatus] = useState<Record<string, CourseStatus>>({})
  const [message, setMessage] = useState<string | null>(null)
  const [workingId, setWorkingId] = useState<string | null>(null)
  const [enrollingAll, setEnrollingAll] = useState(false)
  const [signedIn, setSignedIn] = useState(false)

  useEffect(() => {
    let cancelled = false
    const load = async () => {
      const { data: { user } } = await supabaseBrowser.auth.getUser()
      if (cancelled) return
      setSignedIn(Boolean(user?.id))
      if (!user?.id || initialPath.courses.length === 0) {
        setCourseStatus({})
        return
      }

      const ids = initialPath.courses.map((c) => c.id)
      const { data: enrollments } = await supabaseBrowser
        .from("enrollments")
        .select("course_id, progress, status")
        .eq("user_id", user.id)
        .in("course_id", ids)
        .in("status", ["active", "completed"])

      if (cancelled) return

      const next: Record<string, CourseStatus> = {}
      for (const c of initialPath.courses) {
        const row = enrollments?.find((e) => e.course_id === c.id)
        next[c.id] = {
          enrolled: Boolean(row),
          progress: row?.progress ?? 0,
        }
      }
      setCourseStatus(next)

      const total = initialPath.courses.length
      const sum = initialPath.courses.reduce(
        (acc, c) => acc + (next[c.id]?.progress ?? 0),
        0
      )
      setPath((prev) => ({
        ...prev,
        progress: total > 0 ? Math.round(sum / total) : 0,
        courses: prev.courses.map((c) => ({
          ...c,
          progress: next[c.id]?.progress ?? 0,
        })),
      }))
    }
    load()
    return () => {
      cancelled = true
    }
  }, [initialPath])

  const enrolledCount = useMemo(
    () => Object.values(courseStatus).filter((s) => s.enrolled).length,
    [courseStatus]
  )
  const allEnrolled =
    path.courses.length > 0 && enrolledCount === path.courses.length

  const requireAuth = () => {
    router.push(`/login?next=${encodeURIComponent(`/learning-paths/${path.id}`)}`)
  }

  const handleEnrollOne = async (courseId: string) => {
    setMessage(null)
    if (!signedIn) {
      requireAuth()
      return
    }
    setWorkingId(courseId)
    const result = await enrollInCourse(courseId)
    setWorkingId(null)
    if (!result.ok) {
      if (result.reason === "unauthenticated") {
        requireAuth()
        return
      }
      setMessage(result.message)
      return
    }
    setCourseStatus((prev) => ({
      ...prev,
      [courseId]: { enrolled: true, progress: prev[courseId]?.progress ?? 0 },
    }))
  }

  const handleEnrollAll = async () => {
    setMessage(null)
    if (!signedIn) {
      requireAuth()
      return
    }
    setEnrollingAll(true)
    const failures: string[] = []
    for (const course of path.courses) {
      if (courseStatus[course.id]?.enrolled) continue
      const result = await enrollInCourse(course.id)
      if (result.ok) {
        setCourseStatus((prev) => ({
          ...prev,
          [course.id]: { enrolled: true, progress: prev[course.id]?.progress ?? 0 },
        }))
      } else if (result.reason !== "unauthenticated") {
        failures.push(`${course.title}: ${result.message}`)
      } else {
        requireAuth()
        setEnrollingAll(false)
        return
      }
    }
    setEnrollingAll(false)
    if (failures.length > 0) {
      setMessage(failures.join(" · "))
    }
  }

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <main className="container mx-auto space-y-8 px-4 py-8">
        <Button variant="ghost" className="gap-2 px-0" asChild>
          <Link href="/learning-paths">
            <ArrowLeft className="h-4 w-4" />
            All learning paths
          </Link>
        </Button>

        <div className="grid gap-8 lg:grid-cols-3">
          <div className="space-y-6 lg:col-span-2">
            <div className="space-y-4">
              <div className="flex flex-wrap gap-2">
                {(path.target_audience ?? []).map((audience) => (
                  <Badge key={audience} variant="outline" className="capitalize">
                    {audience}
                  </Badge>
                ))}
              </div>
              <h1 className="font-serif text-4xl font-bold text-foreground">{path.title}</h1>
              <p className="text-lg text-muted-foreground">{path.description}</p>
              <div className="flex flex-wrap gap-4 text-sm text-muted-foreground">
                <span className="flex items-center gap-1">
                  <Clock className="h-4 w-4 text-primary" />
                  {path.durationHours} hours
                </span>
                <span className="flex items-center gap-1">
                  <BookOpen className="h-4 w-4 text-primary" />
                  {path.courseCount} courses
                </span>
              </div>
            </div>

            <Card>
              <CardHeader>
                <CardTitle>Courses in this path</CardTitle>
                <CardDescription>Complete them in order for the best learning sequence</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                {path.courses.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No courses have been added to this path yet.</p>
                ) : (
                  path.courses.map((course, index) => {
                    const status = courseStatus[course.id]
                    const enrolled = status?.enrolled ?? false
                    const progress = status?.progress ?? course.progress ?? 0
                    return (
                      <div
                        key={course.id}
                        className="flex flex-col gap-3 rounded-lg border p-4 sm:flex-row sm:items-center sm:justify-between"
                      >
                        <div className="min-w-0 space-y-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <Badge variant="secondary" className="text-xs">
                              {index + 1}
                            </Badge>
                            <h3 className="font-medium">{course.title}</h3>
                            <Badge variant="outline" className="capitalize text-xs">
                              {course.level}
                            </Badge>
                            {enrolled && (
                              <Badge variant="default" className="gap-1 text-xs">
                                <CheckCircle2 className="h-3 w-3" />
                                Enrolled
                              </Badge>
                            )}
                          </div>
                          <p className="text-sm text-muted-foreground">
                            {course.duration || 0} hours
                            {enrolled ? ` · ${progress}% complete` : ""}
                          </p>
                          {enrolled && <Progress value={progress} className="h-1.5 max-w-xs" />}
                        </div>
                        <div className="flex shrink-0 gap-2">
                          {enrolled ? (
                            <Button asChild size="sm">
                              <Link href={`/courses/${course.id}`}>Continue</Link>
                            </Button>
                          ) : (
                            <Button
                              size="sm"
                              disabled={workingId === course.id || enrollingAll}
                              onClick={() => handleEnrollOne(course.id)}
                            >
                              {workingId === course.id ? (
                                <Loader2 className="h-4 w-4 animate-spin" />
                              ) : (
                                "Enroll"
                              )}
                            </Button>
                          )}
                          <Button variant="outline" size="sm" asChild>
                            <Link href={`/courses/${course.id}`}>View</Link>
                          </Button>
                        </div>
                      </div>
                    )
                  })
                )}
              </CardContent>
            </Card>
          </div>

          <div className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Your progress</CardTitle>
                <CardDescription>
                  {enrolledCount} of {path.courseCount} courses enrolled
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <div className="mb-2 flex justify-between text-sm">
                    <span>Path completion</span>
                    <span>{path.progress}%</span>
                  </div>
                  <Progress value={path.progress} className="h-2" />
                </div>
                <Button
                  className="w-full"
                  disabled={allEnrolled || enrollingAll || path.courses.length === 0}
                  onClick={handleEnrollAll}
                >
                  {enrollingAll ? (
                    <span className="flex items-center gap-2">
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Enrolling…
                    </span>
                  ) : allEnrolled ? (
                    "Enrolled in all courses"
                  ) : (
                    "Enroll in all courses"
                  )}
                </Button>
                {!signedIn && (
                  <p className="text-xs text-muted-foreground">
                    You&apos;ll be asked to sign in before enrollment.
                  </p>
                )}
                {message && (
                  <div className="flex items-start gap-2 rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
                    <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                    <span>{message}</span>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      </main>
    </div>
  )
}
