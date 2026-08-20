"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import { BookOpen, Award, Clock, TrendingUp, Target, Calendar, Play, Building2 } from "lucide-react"
import Link from "next/link"
import type { User, Course, Event } from "@/lib/types/database"
import { EVENT_TYPE_LABEL, eventDate, eventTime } from "@/lib/events/format"
import { formatDateNumeric, getDisplayMonth } from "@/lib/utils/dates"

type UpcomingEvent = Pick<Event, "id" | "title" | "event_type" | "starts_at" | "ends_at" | "location">

interface LearningPathProgress {
  id: string;
  title: string;
  totalCourses: number;
  completedCourses: number;
  inProgressCourses: number;
  progress: number;
}

interface DashboardContentProps {
  user: User | null
  stats: { coursesEnrolled: number; certificatesEarned: number; learningHours: number; progressScore: number }
  recentCourses: Partial<Course & { progress: number; nextLesson: string; timeLeft: string; image: string; completed_at?: string }>[]
  activeCount?: number
  completedCount?: number
  certificates?: { issued_at: string }[]
  learningPath?: LearningPathProgress | null
  upcomingEvents?: UpcomingEvent[]
}

export function DashboardContent({
  user,
  stats,
  recentCourses,
  activeCount = 0,
  completedCount = 0,
  certificates = [],
  learningPath = null,
  upcomingEvents = []
}: DashboardContentProps) {
  const [isLoading] = useState(false)
  // Defer current-month calculation to the client to avoid a hydration mismatch:
  // Vercel renders in UTC; the user's browser may be in a different timezone,
  // so new Date().getMonth() can differ between server and client renders.
  const [currentMonth, setCurrentMonth] = useState<number | null>(null)
  useEffect(() => { setCurrentMonth(new Date().getMonth()) }, [])

  if (isLoading) {
    return <div className="space-y-6">Loading dashboard...</div>
  }

  const thisMonthCerts = currentMonth !== null
    ? certificates.filter(c => getDisplayMonth(c.issued_at) === currentMonth).length
    : 0

  const incompleteCourses = recentCourses.filter(course => course.progress !== undefined && course.progress < 100)
  const completedCourses = recentCourses.filter(course => course.progress !== undefined && course.progress === 100)

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground font-serif">Welcome back, {user?.name || "User"}!</h1>
          <p className="text-muted-foreground">Continue your SSC learning journey</p>
        </div>
        <Badge variant="secondary" className="gap-2">
          <Building2 className="w-4 h-4" />
          {user?.organization ? `${user.user_type} - ${user.organization}` : "LGU Official - Placeholder"}
        </Badge>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {[
          { title: "Courses Enrolled", value: stats.coursesEnrolled, description: `${activeCount} in progress, ${completedCount} completed`, icon: BookOpen, color: "text-blue-600" },
          { title: "Certificates Earned", value: stats.certificatesEarned, description: `${thisMonthCerts} this month`, icon: Award, color: "text-green-600" },
          { title: "Learning Hours", value: stats.learningHours, description: "This month", icon: Clock, color: "text-orange-600" },
          { title: "Progress Score", value: `${stats.progressScore.toFixed(0)}%`, description: "Avg. Course Progress", icon: TrendingUp, color: "text-purple-600" },
        ].map((stat) => (
          <Card key={stat.title}>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">{stat.title}</CardTitle>
              <stat.icon className={`h-4 w-4 ${stat.color}`} />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stat.value}</div>
              <p className="text-xs text-muted-foreground">{stat.description}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <BookOpen className="w-5 h-5" />
                Continue Learning
              </CardTitle>
              <CardDescription>Pick up where you left off</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {incompleteCourses.length > 0 && (
                <>
                  <h3 className="text-lg font-semibold text-foreground">In Progress</h3>
                  {incompleteCourses.map((course) => (
                    <div key={course.id} className="flex items-center gap-4 p-4 border rounded-lg">
                      <div className="w-16 h-16 bg-muted rounded-lg flex items-center justify-center">
                        <BookOpen className="w-6 h-6 text-primary" />
                      </div>
                      <div className="flex-1 space-y-2">
                        <h4 className="font-medium">{course.title}</h4>
                        <div className="flex items-center gap-4 text-sm text-muted-foreground">
                          <span>Next Lesson: {course.nextLesson}</span>
                          <span>{course.timeLeft} remaining</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <Progress value={course.progress!} className="flex-1 h-2" />
                          <span className="text-sm font-medium">{course.progress}%</span>
                        </div>
                      </div>
                      <Button asChild size="sm" className="gap-2">
                        <Link href={`/courses/${course.id}`}>
                          <Play className="w-4 h-4" />
                          Continue
                        </Link>
                      </Button>
                    </div>
                  ))}
                </>
              )}

              {completedCourses.length > 0 && (
                <>
                  <h3 className="text-lg font-semibold text-foreground mt-6">Completed</h3>
                  {completedCourses.map((course) => (
                    <div key={course.id} className="flex items-center gap-4 p-4 border rounded-lg bg-muted/50">
                      <div className="w-16 h-16 bg-muted rounded-lg flex items-center justify-center">
                        <BookOpen className="w-6 h-6 text-green-600" />
                      </div>
                      <div className="flex-1 space-y-2">
                        <h4 className="font-medium">{course.title}</h4>
                        <div className="flex items-center gap-4 text-sm text-muted-foreground">
                          <span>Completed: 100%</span>
                          <span>Finished on {formatDateNumeric(course.completed_at)}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <Progress value={course.progress!} className="flex-1 h-2" />
                          <span className="text-sm font-medium">{course.progress}%</span>
                        </div>
                      </div>
                      <Button asChild size="sm" className="gap-2">
                        <Link href={`/courses/${course.id}`}>
                          <Play className="w-4 h-4" />
                          Review Course
                        </Link>
                      </Button>
                    </div>
                  ))}
                </>
              )}

              {incompleteCourses.length === 0 && completedCourses.length === 0 && (
                <p className="text-muted-foreground text-center">No courses to display.</p>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Target className="w-5 h-5" />
                Learning Path Progress
              </CardTitle>
              <CardDescription className="text-lg font-medium">{learningPath?.title || "No active learning path"}</CardDescription>
            </CardHeader>
            <CardContent>
              {learningPath ? (
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <span className="font-medium">Overall Progress</span>
                    <span className="text-sm font-medium">{learningPath.completedCourses} of {learningPath.totalCourses} courses completed</span>
                  </div>
                  <Progress value={learningPath.progress} className="h-3" />
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div className="flex items-center gap-2">
                      <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                      <span>Completed: {learningPath.completedCourses}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
                      <span>In Progress: {learningPath.inProgressCourses}</span>
                    </div>
                  </div>
                  <Button variant="outline" className="w-full bg-transparent" asChild>
                    <Link href="/dashboard/learningpaths">
                      View Full Learning Path
                    </Link>
                  </Button>
                </div>
              ) : (
                <p className="text-muted-foreground text-center">No active learning path to display.</p>
              )}
            </CardContent>
          </Card>
        </div>

        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Calendar className="w-5 h-5" />
                Upcoming Events
              </CardTitle>
              <CardDescription>Webinars, workshops, and conferences</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {upcomingEvents.length === 0 ? (
                <p className="py-4 text-center text-sm text-muted-foreground">
                  No upcoming events scheduled.
                </p>
              ) : (
                upcomingEvents.map((event) => (
                  <div key={event.id} className="flex items-start gap-3 p-3 border rounded-lg">
                    <div className="w-2 h-2 bg-primary rounded-full mt-2"></div>
                    <div className="flex-1">
                      <h4 className="font-medium text-sm">{event.title}</h4>
                      <p className="text-xs text-muted-foreground">
                        {eventDate(event.starts_at)} at {eventTime(event.starts_at, event.ends_at)}
                      </p>
                      <Badge variant="outline" className="text-xs mt-1">
                        {EVENT_TYPE_LABEL[event.event_type]}
                      </Badge>
                    </div>
                  </div>
                ))
              )}
              <Button variant="outline" size="sm" className="w-full bg-transparent" asChild>
                <Link href="/events">View All Events</Link>
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Quick Actions</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <Button variant="outline" className="w-full justify-start gap-2 bg-transparent" asChild>
                <Link href="/courses">
                  <BookOpen className="w-4 h-4" />
                  Browse Courses
                </Link>
              </Button>
              <Button variant="outline" className="w-full justify-start gap-2 bg-transparent" asChild>
                <Link href="/dashboard/certificates">
                  <Award className="w-4 h-4" />
                  View Certificates
                </Link>
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}