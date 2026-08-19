"use client"

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Progress } from "@/components/ui/progress"
import { Clock, BookOpen, Award, ArrowRight } from "lucide-react"
import { useEffect, useState } from "react"
import { supabaseBrowser } from "@/lib/supabase/browser-client"
import { getBoolSetting, PLACEHOLDER_LEARNING_PATHS_KEY } from "@/lib/settings/app-settings"
import type { LearningPath } from "@/lib/types/database"
import Link from "next/link"

interface CourseInPath {
  id: string
  title: string
  course_order: number
  level: string
  duration: number
  progress: number
}

interface LearningPathWithProgress extends LearningPath {
  progress: number
  courseCount: number
  durationHours: number
  courses: CourseInPath[]
  isMock?: boolean
}

export function LearningPathGrid() {
  const [learningPaths, setLearningPaths] = useState<LearningPathWithProgress[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Hardcoded mock learning paths
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

  useEffect(() => {
    const fetchLearningPaths = async () => {
      setIsLoading(true)
      // Admin-controlled: are the built-in placeholder tracks shown at all?
      // Declared out here so the catch block can still use it, and defaulted to
      // the current behaviour so a transient failure never silently changes
      // what visitors see.
      let placeholders: LearningPathWithProgress[] = mockLearningPaths
      try {
        placeholders = (await getBoolSetting(PLACEHOLDER_LEARNING_PATHS_KEY, true))
          ? mockLearningPaths
          : []

        const { data: { user } } = await supabaseBrowser.auth.getUser()
        const { data: pathsData, error: pathsError } = await supabaseBrowser
          .from('learningpaths')
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
          .eq('status', 'active')
          .order('title', { ascending: true })

        if (pathsError) {
          setError(pathsError.message)
          setLearningPaths(placeholders)
          return
        }

        // Fetch enrollments for progress calculation if user is authenticated
        let enrollments: { course_id: string; progress: number; status: string }[] = []
        if (user?.id) {
          const { data: enrollmentsData, error: enrollmentsError } = await supabaseBrowser
            .from('enrollments')
            .select('course_id, progress, status')
            .eq('user_id', user.id)
            .in('status', ['active', 'completed'])
          if (enrollmentsError) {
          } else {
            enrollments = enrollmentsData || []
          }
        }

        // Process learning paths and calculate progress
        const processedPaths: LearningPathWithProgress[] = (pathsData || []).map(path => {
          const courses: CourseInPath[] = (path.learningpath_courses || [])
            .map((lc: any) => ({
              id: lc.course_id,
              title: lc.courses.title,
              course_order: lc.course_order,
              level: lc.courses.level,
              duration: lc.courses.duration,
              progress: enrollments.find(e => e.course_id === lc.course_id)?.progress || 0
            }))
            .sort((a, b) => a.course_order - b.course_order)

          const courseCount = courses.length
          const totalProgress = courses.reduce((sum: number, course: CourseInPath) => sum + course.progress, 0)
          const progress = courseCount > 0 ? Math.round(totalProgress / courseCount) : 0
          const durationHours = courses.reduce((sum: number, course: CourseInPath) => sum + (course.duration || 0), 0)

          return {
            ...path,
            courses,
            progress,
            courseCount,
            durationHours,
            isMock: false
          }
        })

        // Combine database paths with the placeholder tracks (if still enabled)
        setLearningPaths([...processedPaths, ...placeholders])
      } catch (err: any) {
        setError(err.message || "Failed to load learning paths")
        setLearningPaths(placeholders)
      } finally {
        setIsLoading(false)
      }
    }

    fetchLearningPaths()
  }, [])

  return (
    <div className="space-y-6">
      <div className="text-center">
        <h2 className="text-2xl font-bold text-foreground mb-2">Featured Learning Paths</h2>
        <p className="text-muted-foreground">Structured journeys to master smart city concepts and implementation</p>
      </div>

      {isLoading ? (
        <p className="text-center text-muted-foreground">Loading learning paths...</p>
      ) : error ? (
        <p className="text-center text-red-600">{error}</p>
      ) : learningPaths.length === 0 ? (
        <p className="text-center text-muted-foreground">No learning paths available.</p>
      ) : (
        <div className="grid lg:grid-cols-3 gap-6">
          {learningPaths.map((path) => {
            const buttonLink = !path.isMock ? '/dashboard/learningpaths' : '#'
            const buttonText = path.progress > 0 ? 'Continue Learning Path' : 'Start Learning Path'

            return (
              <Card key={path.id} className="hover:shadow-lg transition-shadow flex flex-col h-full">
                <CardHeader>
                  <div className="flex items-center justify-between mb-2">
                    <Badge variant="secondary">{path.courses?.[0]?.level || 'Beginner'}</Badge>
                    <Badge variant="outline">{path.target_audience.join(', ')}</Badge>
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
                    <span className="text-sm text-muted-foreground">Certificates are awarded upon completion of each course</span>
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