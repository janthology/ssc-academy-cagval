"use client"

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Progress } from "@/components/ui/progress"
import { Clock, BookOpen, Award, ArrowRight } from "lucide-react"
import { useEffect, useState } from "react"
import { supabaseBrowser } from "@/lib/supabase/browser-client"
import {
  mapLearningPaths,
  type LearningPathWithProgress,
} from "@/lib/learning-paths/public-paths"
import Link from "next/link"
import { Skeleton } from "@/components/ui/skeleton"

const mockLearningPaths: LearningPathWithProgress[] = [
  {
    id: "technical-implementation",
    title: "Technical Implementation Track",
    description: "Hands-on technical skills for implementing smart city technologies and systems.",
    target_audience: ["suc", "hei"],
    status: "active",
    created_at: "2025-09-10T00:00:00+00",
    updated_at: "2025-09-10T00:00:00+00",
    created_by: "d1d98402-c8d4-4f3d-8c4e-07d01bcb9dc3",
    progress: 0,
    courseCount: 8,
    durationHours: 64,
    courses: [
      { id: "course1", title: "IoT Fundamentals", course_order: 1, level: "intermediate", duration: 8, progress: 0 },
      { id: "course2", title: "Sensor Networks", course_order: 2, level: "intermediate", duration: 8, progress: 0 },
      { id: "course3", title: "Data Analytics", course_order: 3, level: "intermediate", duration: 8, progress: 0 },
      { id: "course4", title: "System Integration", course_order: 4, level: "intermediate", duration: 8, progress: 0 },
      { id: "course5", title: "Cybersecurity", course_order: 5, level: "intermediate", duration: 8, progress: 0 },
      { id: "course6", title: "Maintenance & Support", course_order: 6, level: "intermediate", duration: 8, progress: 0 },
      { id: "course7", title: "Project Management", course_order: 7, level: "intermediate", duration: 8, progress: 0 },
      { id: "course8", title: "Quality Assurance", course_order: 8, level: "intermediate", duration: 8, progress: 0 },
    ],
    isMock: true,
  },
  {
    id: "research-academic",
    title: "Academic Research Track",
    description: "Advanced concepts and research methodologies for academic institutions and researchers.",
    target_audience: ["suc", "hei"],
    status: "active",
    created_at: "2025-09-10T00:00:00+00",
    updated_at: "2025-09-10T00:00:00+00",
    created_by: "d1d98402-c8d4-4f3d-8c4e-07d01bcb9dc3",
    progress: 0,
    courseCount: 10,
    durationHours: 80,
    courses: [
      { id: "course9", title: "Smart City Theory", course_order: 1, level: "advanced", duration: 8, progress: 0 },
      { id: "course10", title: "Research Methodologies", course_order: 2, level: "advanced", duration: 8, progress: 0 },
      { id: "course11", title: "Data Science", course_order: 3, level: "advanced", duration: 8, progress: 0 },
      { id: "course12", title: "Urban Analytics", course_order: 4, level: "advanced", duration: 8, progress: 0 },
      { id: "course13", title: "Policy Analysis", course_order: 5, level: "advanced", duration: 8, progress: 0 },
      { id: "course14", title: "Innovation Management", course_order: 6, level: "advanced", duration: 8, progress: 0 },
      { id: "course15", title: "Sustainability Metrics", course_order: 7, level: "advanced", duration: 8, progress: 0 },
      { id: "course16", title: "Case Study Analysis", course_order: 8, level: "advanced", duration: 8, progress: 0 },
      { id: "course17", title: "Publication Writing", course_order: 9, level: "advanced", duration: 8, progress: 0 },
      { id: "course18", title: "Grant Applications", course_order: 10, level: "advanced", duration: 8, progress: 0 },
    ],
    isMock: true,
  },
]

function withPlaceholders(
  paths: LearningPathWithProgress[],
  showPlaceholders: boolean
): LearningPathWithProgress[] {
  return showPlaceholders ? [...paths, ...mockLearningPaths] : paths
}

export function LearningPathGrid({
  initialPaths = [],
  showPlaceholders = true,
}: {
  initialPaths?: LearningPathWithProgress[]
  showPlaceholders?: boolean
}) {
  const [learningPaths, setLearningPaths] = useState<LearningPathWithProgress[]>(() =>
    withPlaceholders(initialPaths, showPlaceholders)
  )
  // Only show a spinner when we have nothing to render yet (SSR miss).
  const [isLoading, setIsLoading] = useState(initialPaths.length === 0 && !showPlaceholders)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false

    const enhance = async () => {
      // Seed from server immediately; only fetch enrollments (and a client
      // fallback if SSR returned empty) so progress can update for signed-in users.
      try {
        const { data: { user } } = await supabaseBrowser.auth.getUser()

        let basePaths = initialPaths
        if (basePaths.length === 0) {
          setIsLoading(true)
          const { data: pathsData, error: pathsError } = await supabaseBrowser
            .from("learningpaths")
            .select(`
              id,
              title,
              description,
              target_audience,
              status,
              created_at,
              updated_at,
              created_by,
              learningpath_courses (
                course_id,
                course_order,
                courses (
                  id,
                  title,
                  level,
                  duration
                )
              )
            `)
            .eq("status", "active")
            .order("title", { ascending: true })

          if (pathsError) throw new Error(pathsError.message)
          basePaths = mapLearningPaths((pathsData || []) as any)
        }

        if (!user?.id) {
          if (!cancelled) {
            setLearningPaths(withPlaceholders(basePaths, showPlaceholders))
            setIsLoading(false)
          }
          return
        }

        const { data: enrollmentsData } = await supabaseBrowser
          .from("enrollments")
          .select("course_id, progress, status")
          .eq("user_id", user.id)
          .in("status", ["active", "completed"])

        const enrollments = enrollmentsData || []
        const withProgress: LearningPathWithProgress[] = basePaths.map((path) => {
          const courses = path.courses.map((course) => ({
            ...course,
            progress: enrollments.find((e) => e.course_id === course.id)?.progress || 0,
          }))
          const courseCount = courses.length
          const totalProgress = courses.reduce((sum, course) => sum + course.progress, 0)
          return {
            ...path,
            courses,
            courseCount,
            progress: courseCount > 0 ? Math.round(totalProgress / courseCount) : 0,
            durationHours: courses.reduce((sum, course) => sum + (course.duration || 0), 0),
          }
        })

        if (!cancelled) {
          setLearningPaths(withPlaceholders(withProgress, showPlaceholders))
          setIsLoading(false)
        }
      } catch (err: any) {
        if (!cancelled) {
          setError(err.message || "Failed to load learning paths")
          setLearningPaths(withPlaceholders(initialPaths, showPlaceholders))
          setIsLoading(false)
        }
      }
    }

    enhance()
    return () => {
      cancelled = true
    }
    // initialPaths / showPlaceholders come from SSR and are stable for this mount
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return (
    <div className="space-y-6">
      <div className="text-center">
        <h2 className="text-2xl font-bold text-foreground mb-2">Featured Learning Paths</h2>
        <p className="text-muted-foreground">Structured journeys to master smart city concepts and implementation</p>
      </div>

      {isLoading ? (
        <div className="grid gap-6 lg:grid-cols-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="space-y-4 rounded-lg border p-6">
              <Skeleton className="h-5 w-24" />
              <Skeleton className="h-6 w-4/5" />
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-2/3" />
              <Skeleton className="h-2 w-full" />
              <div className="flex flex-wrap gap-1">
                <Skeleton className="h-5 w-16" />
                <Skeleton className="h-5 w-20" />
                <Skeleton className="h-5 w-14" />
              </div>
              <Skeleton className="h-9 w-full" />
            </div>
          ))}
        </div>
      ) : error ? (
        <p className="text-center text-red-600">{error}</p>
      ) : learningPaths.length === 0 ? (
        <p className="text-center text-muted-foreground">No learning paths available.</p>
      ) : (
        <div className="grid lg:grid-cols-3 gap-6">
          {learningPaths.map((path) => {
            const buttonLink = !path.isMock ? "/dashboard/learningpaths" : "#"
            const buttonText = path.progress > 0 ? "Continue Learning Path" : "Start Learning Path"

            return (
              <Card key={path.id} className="hover:shadow-lg transition-shadow flex flex-col h-full">
                <CardHeader>
                  <div className="flex items-center justify-between mb-2">
                    <Badge variant="secondary">{path.courses?.[0]?.level || "Beginner"}</Badge>
                    <Badge variant="outline">{path.target_audience.join(", ")}</Badge>
                  </div>
                  <CardTitle className="text-xl">{path.title}</CardTitle>
                  <CardDescription>{path.description}</CardDescription>
                </CardHeader>

                <CardContent className="space-y-4 flex flex-col flex-grow">
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div className="flex items-center gap-1">
                      <Clock className="w-4 h-4 text-primary" />
                      {path.durationHours} hours
                    </div>
                    <div className="flex items-center gap-1">
                      <BookOpen className="w-4 h-4 text-primary" />
                      {path.courseCount} courses
                    </div>
                  </div>

                  <div>
                    <div className="flex justify-between text-sm mb-2">
                      <span>Progress</span>
                      <span>{path.progress}%</span>
                    </div>
                    <Progress value={path.progress} className="h-2" />
                  </div>

                  <div className="flex-grow min-h-[100px]">
                    <h4 className="font-medium mb-2 text-sm">Courses:</h4>
                    <div className="flex flex-wrap gap-1">
                      {path.courses?.map((course) => (
                        <Badge key={course.id} variant="outline" className="text-xs">
                          {course.title}
                        </Badge>
                      ))}
                    </div>
                  </div>

                  <div className="flex items-center gap-2 pt-2">
                    <Award className="w-4 h-4 text-primary" />
                    <span className="text-sm text-muted-foreground">
                      Certificates are awarded upon completion of each course
                    </span>
                  </div>

                  <Button
                    className="w-full gap-2 mt-auto"
                    asChild={!path.isMock}
                    disabled={path.isMock}
                  >
                    {!path.isMock ? (
                      <Link href={buttonLink}>
                        <div className="flex items-center gap-2">
                          {buttonText}
                          <ArrowRight className="w-4 h-4" />
                        </div>
                      </Link>
                    ) : (
                      <span className="flex items-center gap-2">
                        {buttonText}
                        <ArrowRight className="w-4 h-4" />
                      </span>
                    )}
                  </Button>
                </CardContent>
              </Card>
            )
          })}
        </div>
      )}
    </div>
  )
}
