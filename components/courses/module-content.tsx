"use client"

import { useState, useEffect } from "react"
import { useParams, useRouter, useSearchParams } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Loader2, CheckCircle, Book, AlertCircle } from "lucide-react"
import { supabaseBrowser } from "@/lib/supabase/browser-client"
import type { Module, Lesson, Resource } from "@/lib/types/database"
import dynamic from "next/dynamic"
import Confetti from "react-confetti"

// react-pdf (pdfjs) touches browser-only APIs (DOMMatrix) at import time, which
// crashes server rendering. Load the viewer client-only so it never runs on the
// server; the PDF is rendered in the browser regardless.
const PdfViewer = dynamic(
  () => import("@/components/courses/pdf-viewer").then((m) => m.PdfViewer),
  { ssr: false }
)

// Minimal interface for module query result
interface ModuleQueryResult {
  id: string
}

// Minimal interface for progress query result
interface ProgressQueryResult {
  lesson_id: string
  completed: boolean
}

// Extended interface for course query result
interface CourseQueryResult {
  id: string
  title: string
}

export function ModuleContent({ courseId, moduleId }: { courseId: string; moduleId: string }) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const isReviewMode = searchParams.get('review') === 'true'

  const [module, setModule] = useState<Module | null>(null)
  const [course, setCourse] = useState<CourseQueryResult | null>(null)
  const [lessons, setLessons] = useState<Lesson[]>([])
  const [resource, setResource] = useState<Resource | null>(null)
  const [pdfUrl, setPdfUrl] = useState<string>("")
  const [completedLessons, setCompletedLessons] = useState<Set<string>>(new Set())
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [showConfetti, setShowConfetti] = useState(false)
  const [showCompletionMessage, setShowCompletionMessage] = useState(false)

  useEffect(() => {

    console.log("ModuleContent useEffect: Fetching data for courseId:", courseId, "moduleId:", moduleId, "isReviewMode:", isReviewMode);

    const fetchModuleData = async () => {
      setIsLoading(true)
      setError(null)
      try {
        const { data: courseData, error: courseError } = await supabaseBrowser
          .from('courses')
          .select('id, title')
          .eq('id', courseId)
          .single()

        if (courseError) throw courseError
        if (!courseData) throw new Error("Course not found")
        setCourse(courseData)

        const { data: moduleData, error: moduleError } = await supabaseBrowser
          .from('modules')
          .select('id, title, description, order, course_id, estimated_duration, is_required')
          .eq('id', moduleId)
          .eq('course_id', courseId)
          .single()

        if (moduleError) throw moduleError
        if (!moduleData) throw new Error("Module not found")
        setModule(moduleData)

        const { data: lessonsData, error: lessonsError } = await supabaseBrowser
          .from('lessons')
          .select('id, module_id, title, type, order, duration, start_page')
          .eq('module_id', moduleId)
          .order('order', { ascending: true })

        if (lessonsError) throw lessonsError
        if (!lessonsData || lessonsData.length === 0) throw new Error("No lessons found for this module")
        setLessons(lessonsData)

        if (!isReviewMode) {
          const { data: { user } } = await supabaseBrowser.auth.getUser()
          if (user?.id) {
            const { data: progressData, error: progressError } = await supabaseBrowser
              .from('progress')
              .select('lesson_id, completed')
              .eq('user_id', user.id)
              .eq('module_id', moduleId)
              .eq('course_id', courseId)
              .eq('completed', true)

            if (progressError) throw progressError
            if (progressData) {
              const completed = new Set<string>(progressData.map((p: ProgressQueryResult) => p.lesson_id))
              setCompletedLessons(completed)
            }
          }
        } else {
          const allLessonIds = new Set(lessonsData.map(l => l.id))
          setCompletedLessons(allLessonIds)
        }

        const { data: resourceData, error: resourceError } = await supabaseBrowser
          .from('resources')
          .select('id, module_id, type, path')
          .eq('module_id', moduleId)
          .eq('type', 'pdf')
          .maybeSingle()

        if (resourceError) throw resourceError
        if (!resourceData) {
          setError("No PDF materials available for this module yet. Please contact the instructor.")
          setIsLoading(false)
          return
        }
        setResource(resourceData)

        const { data: signedData, error: signedError } = await supabaseBrowser.storage
          .from('course-materials')
          .createSignedUrl(resourceData.path, 86400)

        if (signedError) throw signedError
        if (!signedData?.signedUrl) throw new Error("Failed to generate signed URL for PDF")
        setPdfUrl(signedData.signedUrl)
      } catch (err: any) {
        setError(err.message || "Failed to load module content. Please try again.")
      } finally {
        setIsLoading(false)
      }
    }

    fetchModuleData()
  }, [courseId, moduleId, isReviewMode])

  const updateCourseProgress = async (userId: string): Promise<number> => {
    try {
      const { data: modules, error: modulesError } = await supabaseBrowser
        .from('modules')
        .select('id')
        .eq('course_id', courseId)

      if (modulesError) throw modulesError
      const moduleIds = modules.map((m: ModuleQueryResult) => m.id)

      const { count: totalLessons, error: totalError } = await supabaseBrowser
        .from('lessons')
        .select('id', { count: 'exact' })
        .in('module_id', moduleIds)

      if (totalError) throw totalError

      const { count: completedCount, error: completedError } = await supabaseBrowser
        .from('progress')
        .select('id', { count: 'exact' })
        .eq('user_id', userId)
        .eq('course_id', courseId)
        .not('lesson_id', 'is', null)
        .eq('completed', true)

      if (completedError) throw completedError

      const progressPercent = totalLessons && completedCount ? Math.round((completedCount / totalLessons) * 100) : 0

      const updateData: { progress: number; last_accessed_at: string; status?: string; completed_at?: string } = {
        progress: progressPercent,
        last_accessed_at: new Date().toISOString()
      }

      if (progressPercent === 100) {
        updateData.status = 'completed'
        updateData.completed_at = new Date().toISOString()
      }

      const { error: updateError } = await supabaseBrowser
        .from('enrollments')
        .update(updateData)
        .eq('user_id', userId)
        .eq('course_id', courseId)

      if (updateError) throw updateError

      return progressPercent
    } catch (err: any) {
      return 0
    }
  }

  const handleMarkLessonComplete = async (lessonId: string) => {
    if (isReviewMode) {
      alert("You are in review mode. Lesson completion cannot be changed.")
      return
    }

    try {
      const { data: { user } } = await supabaseBrowser.auth.getUser()
      if (!user?.id) throw new Error("User not authenticated")

      const lesson = lessons.find((l: Lesson) => l.id === lessonId)
      if (!lesson) throw new Error("Lesson not found")

      const { data: existingProgress, error: selectError } = await supabaseBrowser
        .from('progress')
        .select('id')
        .eq('user_id', user.id)
        .eq('course_id', courseId)
        .eq('module_id', moduleId)
        .eq('lesson_id', lessonId)
        .single()

      if (selectError && selectError.code !== 'PGRST116') throw selectError

      if (existingProgress) {
        const { error: updateError } = await supabaseBrowser
          .from('progress')
          .update({
            completed: true,
            completed_at: new Date().toISOString(),
            time_spent: lesson.duration || 0
          })
          .eq('id', existingProgress.id)

        if (updateError) throw updateError
      } else {
        const { error: insertError } = await supabaseBrowser
          .from('progress')
          .insert({
            user_id: user.id,
            course_id: courseId,
            module_id: moduleId,
            lesson_id: lessonId,
            completed: true,
            completed_at: new Date().toISOString(),
            time_spent: lesson.duration || 0
          })

        if (insertError) throw insertError
      }

      const { error: enrollmentError } = await supabaseBrowser
        .from('enrollments')
        .update({
          last_accessed_at: new Date().toISOString()
        })
        .eq('user_id', user.id)
        .eq('course_id', courseId)

      if (enrollmentError) throw enrollmentError

      setCompletedLessons(prev => new Set([...prev, lessonId]))
      const progressPercent = await updateCourseProgress(user.id)

      const allComplete = lessons.every((l: Lesson) => completedLessons.has(l.id) || l.id === lessonId)
      if (allComplete) {
        const { data: nextModule } = await supabaseBrowser
          .from('modules')
          .select('id, order')
          .eq('course_id', courseId)
          .gt('order', module?.order || 0)
          .order('order', { ascending: true })
          .limit(1)
          .single()

        if (!nextModule) {
          if (progressPercent === 100) {
            const issueResponse = await fetch("/api/certificates/issue", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ courseId }),
            })

            if (!issueResponse.ok) {
              // The lesson itself was already marked complete; only certificate
              // issuance failed. Surface the API's specific reason (e.g. "no lesson
              // content yet") instead of the generic mark-complete alert below.
              const issueError = await issueResponse.json().catch(() => ({}))
              alert(issueError.error || "Failed to issue certificate")
              router.push(`/courses/${courseId}`)
              return
            }

            setShowConfetti(true)
            setShowCompletionMessage(true)
            setTimeout(() => {
              setShowConfetti(false)
              setShowCompletionMessage(false)
              router.push(`/courses/${courseId}`)
            }, 5000)
          } else {
            router.push(`/courses/${courseId}`)
          }
        } else {
          router.push(`/courses/${courseId}/module/${nextModule.id}`)
        }
      }
    } catch (err: any) {
      alert("Failed to mark lesson as complete. Please try again.")
    }
  }

  if (isLoading) {
    return (
      <div className="container mx-auto px-4 py-8 flex justify-center">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    )
  }

  if (error) {
    return (
      <div className="container mx-auto px-4 py-8">
        <Card>
          <CardHeader className="flex flex-row items-center gap-2">
            <AlertCircle className="h-5 w-5 text-destructive" />
            <CardTitle className="text-destructive">Error</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-destructive">{error}</p>
            <Button onClick={() => router.push(`/courses/${courseId}`)} className="mt-4">
              Back to Course
            </Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  if (!module || !course || !resource || !pdfUrl) {
    return (
      <div className="container mx-auto px-4 py-8">
        <p className="text-muted-foreground">Module content not available.</p>
      </div>
    )
  }

  return (
    <div className="container mx-auto px-4 py-8 grid lg:grid-cols-4 gap-8">
      {showConfetti && (
        <Confetti
          width={window.innerWidth}
          height={window.innerHeight}
          recycle={false}
          numberOfPieces={200}
          gravity={0.1}
        />
      )}
      {showCompletionMessage && (
        <div className="fixed inset-0 flex items-center justify-center bg-black bg-opacity-50 z-50">
          <Card className="p-6 max-w-md text-center">
            <CardTitle className="text-2xl mb-4">Congratulations!</CardTitle>
            <p className="text-lg mb-4">You have successfully completed the course "{course.title}"!</p>
            <p className="text-sm text-muted-foreground">You will be redirected to the course page shortly.</p>
          </Card>
        </div>
      )}
      <div className="lg:col-span-3">
        <Card>
          <CardHeader>
            <CardTitle>Course: {course.title}</CardTitle>
            <p className="text-muted-foreground">Module {module.order}: {module.title}</p>
            <p className="text-muted-foreground">{module.description}</p>
            {isReviewMode && (
              <Badge variant="secondary" className="mt-2">
                Review Mode
              </Badge>
            )}
          </CardHeader>
          <CardContent>
            <PdfViewer url={pdfUrl} initialPage={lessons[0]?.start_page || 1} />
          </CardContent>
        </Card>
      </div>
      <div className="lg:col-span-1 space-y-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Lessons</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {lessons.length === 0 && (
              <p className="text-muted-foreground">No lessons available.</p>
            )}
            {lessons.map((lesson: Lesson) => (
              <div key={lesson.id} className="flex flex-col gap-2">
                <div className="flex items-center">
                  <Book className="w-4 h-4 mr-2" />
                  <span>{lesson.title} (Page {lesson.start_page})</span>
                </div>
                {isReviewMode ? (
                  <Badge
                    variant="secondary"
                    className="bg-green-500 text-white opacity-50 cursor-not-allowed"
                  >
                    <CheckCircle className="w-4 h-4 mr-2" />
                    Completed
                  </Badge>
                ) : (
                  <>
                    {completedLessons.has(lesson.id) ? (
                      <Button
                        size="sm"
                        disabled
                        className="bg-green-500 hover:bg-green-500 text-white"
                      >
                        <CheckCircle className="w-4 h-4 mr-2" />
                        Completed
                      </Button>
                    ) : (
                      <Button
                        size="sm" className="cursor-pointer"
                        onClick={() => handleMarkLessonComplete(lesson.id)}
                      >
                        <CheckCircle className="w-4 h-4 mr-2" />
                        Mark Complete
                      </Button>
                    )}
                  </>
                )}
              </div>
            ))}
          </CardContent>
        </Card>
        <Button
          variant="outline"
          className="w-full"
          onClick={() => router.push(`/courses/${courseId}`)}
        >
          Back to Course
        </Button>
      </div>
    </div>
  )
}