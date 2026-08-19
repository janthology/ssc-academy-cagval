"use client"

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { CheckCircle, Clock, Award, Book, Check } from "lucide-react"
import Link from "next/link"
import { useEffect, useState } from "react"
import { supabaseBrowser } from "@/lib/supabase/browser-client"
import type { Course, Module, Lesson, Enrollment, LearningOutcome } from "@/lib/types/database"

// Define a minimal type for progress data relevant to this component
interface ProgressDataItem {
  lesson_id: string
  completed: boolean
  module_id: string
}

interface CourseContentProps {
  courseId: string
  course: Course
  enrollment: Enrollment | null
  progressData?: ProgressDataItem[] | null
}

export function CourseContent({ courseId, course, enrollment, progressData: initialProgressData }: CourseContentProps) {
  // Fallback learning outcomes
  const fallbackLearningOutcomes = [
    "Understand the fundamental concepts of smart cities",
    "Identify key IoT technologies and their applications",
    "Design basic sensor network architectures",
    "Implement data collection strategies",
    "Evaluate smart city solutions for local contexts",
  ]

  // State for learning outcomes
  const [learningOutcomes, setLearningOutcomes] = useState<LearningOutcome[] | null>(course.learning_outcomes ?? null)
  const [isOutcomesLoading, setIsOutcomesLoading] = useState(false)
  const [outcomesError, setOutcomesError] = useState<string | null>(null)

  // State for progress data
  const [localProgressData, setLocalProgressData] = useState<ProgressDataItem[] | null>(initialProgressData ?? null)
  const [isProgressLoading, setIsProgressLoading] = useState(false)

  // Fetch learning outcomes if not provided in course prop
  useEffect(() => {
    const fetchLearningOutcomes = async () => {
      if (!course.learning_outcomes && !isOutcomesLoading && learningOutcomes === null) {
        setIsOutcomesLoading(true)
        try {
          const { data: outcomesData, error: outcomesError } = await supabaseBrowser
            .from('learningoutcomes')
            .select('id, course_id, outcome, order')
            .eq('course_id', courseId)
            .order('order', { ascending: true }) // Sort by order field
          if (outcomesError) {
            setOutcomesError(outcomesError.message)
            setLearningOutcomes([])
          } else {
            setLearningOutcomes(outcomesData || [])
          }
        } catch (err: any) {
          setOutcomesError(err.message || "Failed to load learning outcomes")
          setLearningOutcomes([])
        } finally {
          setIsOutcomesLoading(false)
        }
      }
    }

    fetchLearningOutcomes()
  }, [courseId, course.learning_outcomes, isOutcomesLoading, learningOutcomes])

  // Fetch progress data if not provided
  useEffect(() => {
    const fetchProgressData = async () => {
      if (initialProgressData === undefined && enrollment && !isProgressLoading && localProgressData === null) {
        setIsProgressLoading(true)
        try {
          const { data: { user } } = await supabaseBrowser.auth.getUser()
          if (user?.id) {
            const { data: progressDataResult, error: progressError } = await supabaseBrowser
              .from('progress')
              .select('lesson_id, completed, module_id')
              .eq('user_id', user.id)
              .eq('course_id', courseId)
              .not('lesson_id', 'is', null)
            if (progressError) {
              setLocalProgressData([])
            } else {
              setLocalProgressData(progressDataResult || [])
            }
          }
        } catch (err: any) {
          setLocalProgressData([])
        } finally {
          setIsProgressLoading(false)
        }
      }
    }

    fetchProgressData()
  }, [courseId, enrollment, initialProgressData, isProgressLoading, localProgressData])

  // Use effective data, sorting learning outcomes by order if available
  const effectiveProgressData = initialProgressData !== undefined ? initialProgressData : localProgressData
  const effectiveLearningOutcomes = learningOutcomes && learningOutcomes.length > 0
    ? [...learningOutcomes].sort((a, b) => a.order - b.order) // Sort by order field
    : fallbackLearningOutcomes

  // Sort modules by order
  const sortedModules = course.modules ? [...course.modules].sort((a: Module, b: Module) => a.order - b.order) : []

  // Function to determine if a module is completed
  const isModuleCompleted = (module: Module): boolean => {
    if (!effectiveProgressData || !Array.isArray(effectiveProgressData) || effectiveProgressData.length === 0) {
      return false
    }
    const moduleLessonIds = new Set((module.lessons || []).map(lesson => lesson.id))
    if (moduleLessonIds.size === 0) {
      return true
    }
    for (const lessonId of moduleLessonIds) {
      const lessonProgress = effectiveProgressData.find(p => p.lesson_id === lessonId)
      if (!lessonProgress || !lessonProgress.completed) {
        return false
      }
    }
    return true
  }

  // Function to get the first lesson ID of a module
  const getFirstLessonId = (module: Module): string | null => {
    if (!module.lessons || module.lessons.length === 0) {
      return null
    }
    const sortedLessons = [...module.lessons].sort((a, b) => a.order - b.order)
    return sortedLessons[0]?.id || null
  }

  return (
    <Tabs defaultValue="curriculum" className="w-full">
      <TabsList className="grid w-full grid-cols-3">
        <TabsTrigger value="curriculum">Curriculum</TabsTrigger>
        <TabsTrigger value="outcomes">Learning Outcomes</TabsTrigger>
        <TabsTrigger value="instructor">Instructor</TabsTrigger>
      </TabsList>

      <TabsContent value="curriculum" className="space-y-4">
        <div className="space-y-4">
          {sortedModules.length === 0 && (
            <p className="text-muted-foreground">No modules available.</p>
          )}
          {sortedModules.map((module: Module) => {
            const moduleCompleted = isModuleCompleted(module)
            const firstLessonId = getFirstLessonId(module)
            let buttonText = "Start Module"
            let buttonDisabled = !firstLessonId || !enrollment
            let buttonLink = firstLessonId ? `/courses/${courseId}/module/${module.id}` : "#"
            let buttonVariant: "default" | "outline" = "default"

            if (moduleCompleted) {
              buttonText = "Review Module"
              buttonLink += "?review=true"
              buttonVariant = "outline"
            }

            return (
              <Card key={module.id}>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
                        <span className="text-sm font-medium text-primary">{module.order}</span>
                      </div>
                      <div>
                        <CardTitle className="text-lg flex items-center gap-2">
                          {module.title}
                          <Badge variant="secondary">{module.is_required ? "Required" : "Optional"}</Badge>
                        </CardTitle>
                        <CardDescription>{module.description}</CardDescription>
                      </div>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4 text-sm text-muted-foreground">
                      <div className="flex items-center gap-1">
                        <Clock className="w-4 h-4" />
                        {module.estimated_duration} min
                      </div>
                    </div>
                    <Button
                      variant={buttonVariant}
                      size="sm"
                      disabled={buttonDisabled}
                      asChild={!!firstLessonId && !!enrollment}
                    >
                      {firstLessonId && enrollment ? (
                        <Link href={buttonLink}>
                          {buttonText}
                        </Link>
                      ) : (
                        <span>{buttonText}</span>
                      )}
                    </Button>
                  </div>
                  {moduleCompleted && (
                    <div className="flex justify-end">
                      <Badge variant="default" className="gap-1 bg-green-500">
                        <Check className="w-3 h-3" /> Completed
                      </Badge>
                    </div>
                  )}
                  <div className="space-y-2">
                    <h4 className="font-medium text-sm">Lessons</h4>
                    {module.lessons?.length ? (
                      <ul className="space-y-2">
                        {module.lessons.map((lesson: Lesson) => (
                          <li key={lesson.id} className="flex items-center gap-2 text-sm">
                            <Book className="w-4 h-4 text-primary" />
                            <span>{lesson.title}</span>
                            <span className="text-muted-foreground">({lesson.duration} min, Page {lesson.start_page})</span>
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <p className="text-sm text-muted-foreground">No lessons available.</p>
                    )}
                  </div>
                </CardContent>
              </Card>
            )
          })}
        </div>
      </TabsContent>

      <TabsContent value="outcomes" className="space-y-4">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Award className="w-5 h-5 text-primary" />
              What You'll Learn
            </CardTitle>
            <CardDescription>By the end of this course, you will be able to:</CardDescription>
          </CardHeader>
          <CardContent>
            {isOutcomesLoading ? (
              <p className="text-muted-foreground">Loading learning outcomes...</p>
            ) : outcomesError ? (
              <p className="text-red-600">{outcomesError}</p>
            ) : effectiveLearningOutcomes.length === 0 ? (
              <p className="text-muted-foreground">No learning outcomes available.</p>
            ) : (
              <ul className="space-y-3">
                {effectiveLearningOutcomes.map((outcome, index) => (
                  <li key={typeof outcome === 'string' ? index : outcome.id} className="flex items-start gap-3">
                    <CheckCircle className="w-5 h-5 text-primary mt-0.5 flex-shrink-0" />
                    <span>{typeof outcome === 'string' ? outcome : outcome.outcome}</span>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </TabsContent>

      <TabsContent value="instructor" className="space-y-4">
        <Card>
          <CardHeader>
            <CardTitle>{course.instructor}</CardTitle>
            <CardDescription>Smart Cities Expert</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-muted-foreground">
              {course.instructor} is a leading expert in smart city technologies with extensive experience in IoT
              implementation and urban planning.
            </p>
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <span className="font-medium">Experience:</span>
                <p className="text-muted-foreground">15+ years</p>
              </div>
              <div>
                <span className="font-medium">Students Taught:</span>
                <p className="text-muted-foreground">{course.enrollment_count !== null ? course.enrollment_count.toLocaleString() : 0}</p>
              </div>
              <div>
                <span className="font-medium">Specialization:</span>
                <p className="text-muted-foreground">{course.category}</p>
              </div>
              <div>
                <span className="font-medium">Rating:</span>
                <p className="text-muted-foreground">{course.rating !== null ? `${course.rating}/5.0` : "N/A"}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </TabsContent>
    </Tabs>
  )
}