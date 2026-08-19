"use client"

import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { BookOpen, Clock, Play, CheckCircle, Calendar, Star, Eye } from "lucide-react"
import Link from "next/link"
import Image from "next/image"
import { useState } from "react"
import type { User } from "@/lib/types/database"

// Interface for the enriched enrolled course data
interface EnrolledCourse {
  id: string
  title: string
  instructor: string
  progress: number
  status: "In Progress" | "Completed"
  nextLesson: string
  timeSpent: string // This will now be a formatted string like "2.5 hours"
  estimatedTime: string // This will now be a formatted string like "1.8 hours"
  lastAccessed: string
  rating: number
  image: string
  completed_at?: string
  certificateId?: string | null
  lessonsCompleted: string
}

interface EnrolledCoursesProps {
  enrolledCourses: EnrolledCourse[]
  user: User | null
}

// Utility function to format date as MM/DD/YYYY
const formatDate = (dateStr: string | undefined): string => {
  if (!dateStr) return "N/A"
  const date = new Date(dateStr)
  if (isNaN(date.getTime())) return "N/A"
  const month = String(date.getMonth() + 1).padStart(2, "0")
  const day = String(date.getDate()).padStart(2, "0")
  const year = date.getFullYear()
  return `${month}/${day}/${year}`
}

export function EnrolledCourses({ enrolledCourses = [], user }: EnrolledCoursesProps) {
  // Separate courses for tabs
  const completedCourses = enrolledCourses.filter((course) => course.status === "Completed")
  const inProgressCourses = enrolledCourses.filter((course) => course.status === "In Progress")

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground font-serif">My Courses</h1>
          <p className="text-muted-foreground">Track your learning progress and continue your journey</p>
        </div>
        <Button asChild>
          <Link href="/courses">Browse More Courses</Link>
        </Button>
      </div>

      <Tabs defaultValue="all" className="w-full">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="all">All Courses ({enrolledCourses.length})</TabsTrigger>
          <TabsTrigger value="in-progress">In Progress ({inProgressCourses.length})</TabsTrigger>
          <TabsTrigger value="completed">Completed ({completedCourses.length})</TabsTrigger>
        </TabsList>

        <TabsContent value="all" className="space-y-4">
          <div className="grid gap-6">
            {enrolledCourses.length === 0 ? (
              <div className="text-center py-8">
                <BookOpen className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                <h3 className="text-lg font-medium mb-2">No courses found</h3>
                <p className="text-muted-foreground">
                  You haven't enrolled in any courses yet.
                </p>
                <Button asChild className="mt-4">
                  <Link href="/courses">Browse Courses</Link>
                </Button>
              </div>
            ) : (
              enrolledCourses.map((course) => (
                <CourseCard key={course.id} course={course} />
              ))
            )}
          </div>
        </TabsContent>

        <TabsContent value="in-progress" className="space-y-4">
          <div className="grid gap-6">
            {inProgressCourses.length === 0 ? (
              <div className="text-center py-8">
                <Play className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                <h3 className="text-lg font-medium mb-2">No courses in progress</h3>
                <p className="text-muted-foreground">Start a new course to begin learning</p>
                <Button asChild className="mt-4">
                  <Link href="/courses">Browse Courses</Link>
                </Button>
              </div>
            ) : (
              inProgressCourses.map((course) => (
                <CourseCard key={course.id} course={course} />
              ))
            )}
          </div>
        </TabsContent>

        <TabsContent value="completed" className="space-y-4">
          <div className="grid gap-6">
            {completedCourses.length === 0 ? (
              <div className="text-center py-8">
                <CheckCircle className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                <h3 className="text-lg font-medium mb-2">No completed courses</h3>
                <p className="text-muted-foreground">Complete courses to earn certificates</p>
              </div>
            ) : (
              completedCourses.map((course) => (
                <CourseCard key={course.id} course={course} />
              ))
            )}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  )
}

function CourseCard({ course }: { course: EnrolledCourse }) {
  const [imgSrc, setImgSrc] = useState(course.image || "/placeholder.svg")
  return (
    <Card>
      <CardContent className="p-6">
        <div className="flex flex-col md:flex-row gap-6">
          <div className="relative w-full md:w-32 h-32 md:h-24 rounded-lg flex-shrink-0 overflow-hidden bg-muted">
            <Image
              src={imgSrc}
              alt={course.title}
              fill
              sizes="(max-width: 768px) 100vw, 128px"
              className="object-cover"
              onError={() => setImgSrc("/placeholder.jpg")}
            />
          </div>

          <div className="flex-1 space-y-4">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-2">
              <div>
                <h3 className="text-xl font-semibold">{course.title}</h3>
                <p className="text-muted-foreground">by {course.instructor}</p>
              </div>
              <Badge
                variant={course.status === "Completed" ? "default" : "secondary"}
                className={course.status === "Completed" ? "bg-green-500" : ""}
              >
                {course.status}
              </Badge>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 text-sm">
              <div className="flex items-center gap-2">
                <Clock className="w-4 h-4 text-primary" />
                <span>Time Spent: {course.timeSpent}</span>
              </div>
              <div className="flex items-center gap-2">
                <Calendar className="w-4 h-4 text-primary" />
                <span>Last Accessed: {formatDate(course.lastAccessed)}</span>
              </div>
              <div className="flex items-center gap-2">
                <Star className="w-4 h-4 fill-yellow-400 text-yellow-400" />
                <span>Rating: {course.rating.toFixed(1)}</span>
              </div>
              <div className="flex items-center gap-2">
                {course.status === "Completed" ? (
                  <CheckCircle className="w-4 h-4 text-green-500" />
                ) : (
                  <Play className="w-4 h-4 text-primary" />
                )}
                <span>
                  {course.status === "Completed"
                    ? "Course completed"
                    : `Time Left: ${course.estimatedTime}`}
                </span>
              </div>
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span>
                  {course.status === "Completed"
                    ? "Course completed"
                    : `Next Lesson: ${course.nextLesson}`}
                </span>
                <span className="font-medium">{course.progress}%</span>
              </div>
              <Progress value={course.progress} className="h-2" />
            </div>

            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="text-sm text-muted-foreground">
                {course.lessonsCompleted} lessons completed
              </div>
              <div className="flex flex-wrap gap-2">
                {course.status === "Completed" ? (
                  <>
                    {course.certificateId ? (
                      <Button variant="secondary" size="sm" className="bg-green-500 hover:bg-green-600" asChild>
                        <Link href={`/certificates/${course.certificateId}`}>
                          <Eye className="w-4 h-4 mr-2" />
                          View Certificate
                        </Link>
                      </Button>
                    ) : (
                      <Button variant="outline" size="sm" disabled>
                        <Eye className="w-4 h-4 mr-2" />
                        Certificate Pending
                      </Button>
                    )}
                    <Button variant="outline" size="sm" asChild>
                      <Link href={`/courses/${course.id}`}>
                        Review Course
                      </Link>
                    </Button>
                  </>
                ) : (
                  // --- REMOVED "Course Details" BUTTON FOR IN-PROGRESS COURSES ---
                  <Button size="sm" className="gap-2" asChild>
                    <Link href={`/courses/${course.id}`}>
                      <Play className="w-4 h-4" />
                      Continue
                    </Link>
                  </Button>
                  // --- END REMOVAL ---
                )}
              </div>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}