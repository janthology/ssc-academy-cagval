"use client"

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Progress } from "@/components/ui/progress"
import { Clock, BookOpen, Award, ArrowRight, Building2 } from "lucide-react"
import { useEffect, useState } from "react"
import { supabaseBrowser } from "@/lib/supabase/browser-client"
import {
  mapLearningPaths,
  type LearningPathWithProgress,
} from "@/lib/learning-paths/public-paths"
import Link from "next/link"
import { Skeleton } from "@/components/ui/skeleton"

interface UserData {
  name: string | null
  user_type: string | null
  organization: string | null
}

export function LearningPathsDashboard() {
  const [learningPaths, setLearningPaths] = useState<LearningPathWithProgress[]>([])
  const [userData, setUserData] = useState<UserData>({ name: null, user_type: null, organization: null })
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const fetchData = async () => {
      setIsLoading(true)
      try {
        const { data: { user } } = await supabaseBrowser.auth.getUser()
        let nextUser: UserData = { name: null, user_type: null, organization: null }

        if (user?.id) {
          const { data: userDataResult } = await supabaseBrowser
            .from("users")
            .select("name, user_type, organization")
            .eq("id", user.id)
            .single()
          nextUser = userDataResult || nextUser
        }
        setUserData(nextUser)

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

        let enrollments: { course_id: string; progress: number; status: string }[] = []
        if (user?.id) {
          const { data: enrollmentsData } = await supabaseBrowser
            .from("enrollments")
            .select("course_id, progress, status")
            .eq("user_id", user.id)
            .in("status", ["active", "completed"])
          enrollments = enrollmentsData || []
        }

        setLearningPaths(mapLearningPaths((pathsData || []) as any, enrollments))
      } catch (err: any) {
        setError(err.message || "Failed to load learning paths")
        setLearningPaths([])
      } finally {
        setIsLoading(false)
      }
    }

    fetchData()
  }, [])

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground font-serif">Learning Paths</h1>
          <p className="text-muted-foreground">Track your progress and explore available learning paths</p>
        </div>
        {(userData.user_type || userData.organization) && (
          <Badge variant="secondary" className="gap-2">
            <Building2 className="w-4 h-4" />
            {[userData.user_type, userData.organization].filter(Boolean).join(" · ")}
          </Badge>
        )}
      </div>

      {isLoading ? (
        <div className="space-y-4">
          {Array.from({ length: 2 }).map((_, i) => (
            <Skeleton key={i} className="h-48 w-full" />
          ))}
        </div>
      ) : error ? (
        <p className="text-center text-red-600">{error}</p>
      ) : learningPaths.length === 0 ? (
        <p className="text-center text-muted-foreground">No learning paths available.</p>
      ) : (
        <div className="space-y-6">
          {learningPaths.map((path) => {
            const buttonText = path.progress > 0 ? "Continue Learning Path" : "View Learning Path"

            return (
              <Card key={path.id} className="hover:shadow-lg transition-shadow flex flex-col">
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
                      <span>Path Progress</span>
                      <span>{path.progress}%</span>
                    </div>
                    <Progress value={path.progress} className="h-2" />
                  </div>

                  <div className="flex-grow">
                    <h4 className="font-medium mb-2 text-sm">Courses:</h4>
                    <ul className="list-disc pl-5 text-sm space-y-3">
                      {path.courses?.map((course) => (
                        <li key={course.id} className="flex flex-col gap-2">
                          <div className="flex items-center justify-between gap-2">
                            <span>
                              {course.title} (Duration: {course.duration} hours | Progress: {course.progress}% complete)
                            </span>
                            {course.progress === 100 ? (
                              <div className="flex items-center gap-2">
                                <Badge className="bg-green-500 text-white">Completed</Badge>
                                <Button variant="outline" size="sm" asChild>
                                  <Link href={`/courses/${course.id}`}>Review Course</Link>
                                </Button>
                              </div>
                            ) : (
                              <Button variant="outline" size="sm" asChild>
                                <Link href={`/courses/${course.id}`}>View Course</Link>
                              </Button>
                            )}
                          </div>
                          <Progress value={course.progress} className="h-1.5" />
                        </li>
                      ))}
                    </ul>
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
