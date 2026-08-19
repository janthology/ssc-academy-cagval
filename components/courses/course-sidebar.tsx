"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Progress as ProgressComponent } from "@/components/ui/progress"
import { Badge } from "@/components/ui/badge"
import { Clock, Users, Award, BookOpen, Download, XCircle, CheckCircle } from "lucide-react"
import Link from "next/link"
import { supabaseBrowser } from "@/lib/supabase/browser-client"
import type { Course, Enrollment } from "@/lib/types/database"
import { useEffect, useState } from "react"

// Minimal interfaces for query results
interface ModuleQueryResult {
  id: string
  order: number
}

// Define a minimal type for the raw lesson data fetched
interface RawLessonData {
  id: string
  module_id: string
  order: number
}

// Define the structure for a lesson including its module's order for sorting
interface LessonWithModuleOrder extends RawLessonData {
  module: {
    order: number // Module order, to be added manually
  }
}

interface ProgressQueryResult {
  lesson_id: string
  completed: boolean
}

interface CourseSidebarProps {
  courseId: string
  enrollment: Enrollment | null
  course: Course
}

export function CourseSidebar({ courseId, enrollment, course }: CourseSidebarProps) {
  const [certificateId, setCertificateId] = useState<string | null>(null)

  useEffect(() => {
    const fetchCertificate = async () => {
      if (enrollment?.progress === 100) {
        try {
          const { data: { user } } = await supabaseBrowser.auth.getUser()
          if (!user?.id) throw new Error("User not authenticated")

          const { data, error } = await supabaseBrowser
            .from('certificates')
            .select('id')
            .eq('user_id', user.id)
            .eq('course_id', courseId)
            .eq('status', 'active')
            .single()

          if (error && error.code !== 'PGRST116') throw error
          setCertificateId(data?.id || null)
        } catch (err: any) {
        }
      }
    }

    fetchCertificate()
  }, [courseId, enrollment?.progress])

  const handleDropCourse = async () => {
    const userConfirmed = window.confirm(
      `Are you sure you want to drop the course "${course.title}"? This will remove your enrollment and all progress for this course. This action cannot be undone.`
    )

    if (!userConfirmed) {
      return
    }

    try {
      const { data: { user } } = await supabaseBrowser.auth.getUser()
      if (!user?.id) throw new Error("User not authenticated")

      const { error: deleteEnrollmentError } = await supabaseBrowser
        .from('enrollments')
        .delete()
        .eq('user_id', user.id)
        .eq('course_id', courseId)

      if (deleteEnrollmentError) throw deleteEnrollmentError

      const { error: deleteProgressError } = await supabaseBrowser
        .from('progress')
        .delete()
        .eq('user_id', user.id)
        .eq('course_id', courseId)

      if (deleteProgressError) throw deleteProgressError

      window.location.reload()
    } catch (err: any) {
      alert("Failed to drop the course. Please try again.")
    }
  }

  const handleContinueLearning = async () => {
    try {
      const { data: { user } } = await supabaseBrowser.auth.getUser()
      if (!user?.id) throw new Error("User not authenticated")

      const { data: modules, error: modulesError } = await supabaseBrowser
        .from('modules')
        .select('id, order')
        .eq('course_id', courseId)
        .order('order', { ascending: true })

      if (modulesError) throw modulesError
      if (!modules || modules.length === 0) throw new Error("No modules found for this course")

      const lessonsQueryResult = await supabaseBrowser
        .from('lessons')
        .select(`
          id,
          module_id,
          order
        `)
        .in('module_id', modules.map((m: ModuleQueryResult) => m.id))

      if (lessonsQueryResult.error) {
        throw lessonsQueryResult.error
      }

      const lessonsData = lessonsQueryResult.data as unknown as RawLessonData[]

      const moduleOrderMap = new Map(modules.map(m => [m.id, m.order]))

      const lessons: LessonWithModuleOrder[] = lessonsData
        .map(lesson => ({
          id: lesson.id,
          module_id: lesson.module_id,
          order: lesson.order,
          module: { order: moduleOrderMap.get(lesson.module_id) ?? Number.MAX_SAFE_INTEGER }
        }))
        .sort((a, b) => {
          if (a.module.order !== b.module.order) {
            return a.module.order - b.module.order
          }
          return a.order - b.order
        })

      const { data: progress, error: progressError } = await supabaseBrowser
        .from('progress')
        .select('lesson_id, completed')
        .eq('user_id', user.id)
        .eq('course_id', courseId)
        .not('lesson_id', 'is', null)

      if (progressError) throw progressError

      const completedLessonIds = new Set(progress.filter((p: ProgressQueryResult) => p.completed).map((p: ProgressQueryResult) => p.lesson_id))

      const nextIncompleteLesson = lessons.find((lesson) => !completedLessonIds.has(lesson.id))

      if (nextIncompleteLesson) {
        window.location.href = `/courses/${courseId}/module/${nextIncompleteLesson.module_id}`
      } else {
        window.location.href = `/courses/${courseId}`
      }
    } catch (err: any) {
      alert("Failed to load module. Please try again.")
    }
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Your Progress</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <div className="flex justify-between text-sm mb-2">
              <span>Course Completion</span>
              <span>{enrollment?.progress || 0}%</span>
            </div>
            <ProgressComponent value={enrollment?.progress || 0} className="h-2" />
          </div>
          {enrollment ? (
            enrollment.progress === 100 ? (
              <>
                <Button
                  disabled
                  className="w-full bg-green-500 hover:bg-green-500 text-white cursor-not-allowed"
                >
                  <CheckCircle className="w-4 h-4 mr-2" />
                  Course Completed
                </Button>
                {certificateId && (
                  <Button
                    asChild
                    className="w-full cursor-pointer"
                  >
                    <Link href={`/certificates/${certificateId}`}>
                      <Award className="w-4 h-4 mr-2" />
                      View Certificate
                    </Link>
                  </Button>
                )}
              </>
            ) : (
              <>
                <Button onClick={handleContinueLearning} className="w-full cursor-pointer">
                  <BookOpen className="w-4 h-4 mr-2" />
                  Continue Learning
                </Button>
                <Button
                  variant="destructive"
                  className="w-full gap-2 cursor-pointer"
                  onClick={handleDropCourse}
                >
                  <XCircle className="w-4 h-4" />
                  Drop Course
                </Button>
              </>
            )
          ) : (
            <Button className="w-full opacity-50" disabled>
              <BookOpen className="w-4 h-4 mr-2" />
              Continue Learning
            </Button>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Course Details</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-3">
            <div className="flex items-center gap-2 text-sm">
              <Clock className="w-4 h-4 text-primary" />
              <span>{course.duration} hours</span>
            </div>
            <div className="flex items-center gap-2 text-sm">
              <BookOpen className="w-4 h-4 text-primary" />
              <span>{course.modules?.length || 0} modules</span>
            </div>
            <div className="flex items-center gap-2 text-sm">
              <Users className="w-4 h-4 text-primary" />
              <span>{course.enrollment_count !== null ? course.enrollment_count.toLocaleString() : 0} students enrolled</span>
            </div>
            <div className="flex items-center gap-2 text-sm">
              <Award className="w-4 h-4 text-primary" />
              <span>Certificate included</span>
            </div>
          </div>

          <div className="pt-2">
            <h4 className="font-medium mb-2">Prerequisites</h4>
            {course.prerequisites?.length ? (
              course.prerequisites.map((prereq, index) => (
                <Badge key={index} variant="outline" className="text-xs">
                  {prereq}
                </Badge>
              ))
            ) : (
              <p className="text-sm text-muted-foreground">None</p>
            )}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Course Resources</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <Button variant="outline" className="w-full justify-start gap-2 bg-transparent" disabled>
            <Download className="w-4 h-4" />
            Course Materials
          </Button>
          <Button variant="outline" className="w-full justify-start gap-2 bg-transparent" disabled>
            <BookOpen className="w-4 h-4" />
            Reading List
          </Button>
          <Button variant="outline" className="w-full justify-start gap-2 bg-transparent" disabled>
            <Users className="w-4 h-4" />
            Discussion Forum
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Related Courses</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="space-y-2">
            <h4 className="text-sm font-medium">Smart City Data Analytics</h4>
            <p className="text-xs text-muted-foreground">Intermediate • 6 hours</p>
          </div>
          <div className="space-y-2">
            <h4 className="text-sm font-medium">Digital Governance</h4>
            <p className="text-xs text-muted-foreground">Intermediate • 5 hours</p>
          </div>
          <Button variant="outline" size="sm" className="w-full bg-transparent" asChild>
            <Link href="/courses">
              View All Courses
            </Link>
          </Button>
        </CardContent>
      </Card>
    </div>
  )
}