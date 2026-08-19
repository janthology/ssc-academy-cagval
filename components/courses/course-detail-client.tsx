"use client"

import { useState, useEffect } from "react"
import { Header } from "@/components/ui/header"
import { CourseHeader } from "@/components/courses/course-header"
import { CourseContent } from "@/components/courses/course-content"
import { CourseSidebar } from "@/components/courses/course-sidebar"
import { Loader2 } from "lucide-react"
import { supabaseBrowser } from "@/lib/supabase/browser-client"
import type { Course, Enrollment, Module } from "@/lib/types/database"

interface ProgressDataItem {
  lesson_id: string
  completed: boolean
  module_id: string
}

/**
 * Per-user client island for the course detail page. The public course-level meta
 * is server-rendered/cached (see app/courses/[id]/page.tsx) and passed in as
 * `course`. Everything user-specific is fetched here with the real session:
 *  - modules + lessons — via supabaseBrowser, so modules_public_read applies per
 *    user (an instructor-owner still sees their OWN unpublished modules, exactly
 *    as before this split).
 *  - enrollment, get_unmet_prerequisites (auth.uid()), progress — never cached.
 */
export function CourseDetailClient({
  courseId,
  course: courseMeta,
}: {
  courseId: string
  course: Course | null
}) {
  const [course, setCourse] = useState<Course | null>(null)
  const [enrollment, setEnrollment] = useState<Enrollment | null>(null)
  const [progressData, setProgressData] = useState<ProgressDataItem[] | null>(null)
  const [unmetPrereqs, setUnmetPrereqs] = useState<string[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const load = async () => {
      setIsLoading(true)
      setError(null)
      try {
        if (!courseMeta) {
          setError("Course not found.")
          return
        }

        // Modules + lessons fetched with the user session (RLS per user).
        const { data: modules, error: modulesError } = await supabaseBrowser
          .from("modules")
          .select(
            "id, title, description, order, estimated_duration, is_required, lessons(id, module_id, title, type, order, duration, start_page)"
          )
          .eq("course_id", courseId)
        if (modulesError) throw modulesError

        const sortedModules = (modules ?? [])
          .slice()
          .sort((a: any, b: any) => a.order - b.order)
          .map((m: any) => ({
            ...m,
            lessons: (m.lessons ?? []).slice().sort((a: any, b: any) => a.order - b.order),
          }))

        const fullCourse = { ...courseMeta, modules: sortedModules as Module[] } as Course
        setCourse(fullCourse)

        const { data: { user } } = await supabaseBrowser.auth.getUser()
        let userEnrollment: Enrollment | null = null
        if (user?.id) {
          const { data: enrollmentData, error: enrollmentError } = await supabaseBrowser
            .from("enrollments")
            .select("*")
            .eq("course_id", courseId)
            .eq("user_id", user.id)
            .maybeSingle()
          if (enrollmentError && enrollmentError.code !== "PGRST116") throw enrollmentError
          userEnrollment = enrollmentData || null
          setEnrollment(userEnrollment)

          const { data: unmetData } = await supabaseBrowser.rpc("get_unmet_prerequisites", {
            p_course_id: courseId,
          })
          setUnmetPrereqs(Array.isArray(unmetData) ? unmetData : [])

          if (userEnrollment) {
            const { data: progressDataResult, error: progressError } = await supabaseBrowser
              .from("progress")
              .select("lesson_id, completed, module_id")
              .eq("user_id", user.id)
              .eq("course_id", courseId)
              .not("lesson_id", "is", null)
            setProgressData(progressError ? [] : progressDataResult || [])
          } else {
            setProgressData([])
          }
        } else {
          setProgressData([])
        }
      } catch (err: any) {
        setError("Failed to load course. Please try again.")
        setProgressData([])
      } finally {
        setIsLoading(false)
      }
    }
    load()
  }, [courseId, courseMeta])

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background">
        <Header />
        <div className="container mx-auto px-4 py-8 flex justify-center">
          <Loader2 className="h-8 w-8 animate-spin" />
        </div>
      </div>
    )
  }

  if (error || !course) {
    return (
      <div className="min-h-screen bg-background">
        <Header />
        <div className="container mx-auto px-4 py-8">
          <p className="text-red-600">{error || "Course not found."}</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <div className="container mx-auto px-4 py-8">
        <CourseHeader courseId={course.id} course={course} enrollment={enrollment} unmetPrereqs={unmetPrereqs} />
        <div className="grid lg:grid-cols-4 gap-8 mt-8">
          <div className="lg:col-span-3">
            <CourseContent courseId={course.id} course={course} enrollment={enrollment} progressData={progressData} />
          </div>
          <div className="lg:col-span-1">
            <CourseSidebar courseId={course.id} enrollment={enrollment} course={course} />
          </div>
        </div>
      </div>
    </div>
  )
}
