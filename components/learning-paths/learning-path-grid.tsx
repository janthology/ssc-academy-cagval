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

export function LearningPathGrid({
  initialPaths = [],
}: {
  initialPaths?: LearningPathWithProgress[]
}) {
  const [learningPaths, setLearningPaths] = useState<LearningPathWithProgress[]>(initialPaths)
  const [isLoading, setIsLoading] = useState(initialPaths.length === 0)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false

    const enhance = async () => {
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
            setLearningPaths(basePaths)
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
          setLearningPaths(withProgress)
          setIsLoading(false)
        }
      } catch (err: any) {
        if (!cancelled) {
          setError(err.message || "Failed to load learning paths")
          setLearningPaths(initialPaths)
          setIsLoading(false)
        }
      }
    }

    enhance()
    return () => {
      cancelled = true
    }
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

                  <Button className="w-full gap-2 mt-auto" asChild>
                    <Link href={`/learning-paths/${path.id}`}>
                      <span className="flex items-center gap-2">
                        {buttonText}
                        <ArrowRight className="w-4 h-4" />
                      </span>
                    </Link>
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
