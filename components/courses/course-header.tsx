"use client"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Clock, BookOpenText, Users, Star, Award, Play, Lock, AlertCircle } from "lucide-react"
import Image from "next/image"
import { useState } from "react"
import type { Course, Enrollment } from "@/lib/types/database"
import { formatNumber } from "@/lib/utils/dates"
import { enrollInCourse } from "@/lib/courses/enroll"

interface CourseHeaderProps {
  courseId: string
  course: Course
  enrollment: Enrollment | null
  // Unmet prerequisite course titles for the current user (computed by the page
  // via get_unmet_prerequisites). Empty when eligible or not applicable.
  unmetPrereqs?: string[]
}

export function CourseHeader({ courseId, course, enrollment, unmetPrereqs = [] }: CourseHeaderProps) {
  const [message, setMessage] = useState<string | null>(null)
  const locked = !enrollment && unmetPrereqs.length > 0

  const handleEnroll = async () => {
    setMessage(null)
    const result = await enrollInCourse(courseId)
    if (!result.ok) {
      setMessage(result.message)
      return
    }
    if (result.alreadyEnrolled) {
      window.location.reload()
      return
    }
    window.location.reload()
  }

  return (
    <div className="grid lg:grid-cols-2 gap-8 items-start">
      <div>
        <div className="flex items-center gap-2 mb-4">
          <Badge variant="secondary">{course.level}</Badge>
          <Badge variant="outline">{course.category}</Badge>
        </div>

        <h1 className="text-4xl font-bold text-foreground mb-4 font-serif">{course.title}</h1>

        <p className="text-lg text-muted-foreground mb-6 leading-relaxed">{course.description}</p>

        <div className="grid grid-cols-2 gap-4 mb-6">
          <div className="flex items-center gap-2 text-sm">
            <Clock className="w-4 h-4 text-primary" />
            <span>{course.duration} hours</span>
          </div>
          <div className="flex items-center gap-2 text-sm">
            <BookOpenText className="w-4 h-4 text-primary" />
            <span>{course.modules?.length || 0} modules</span>
          </div>
          <div className="flex items-center gap-2 text-sm">
            <Star className="w-4 h-4 fill-yellow-400 text-yellow-400" />
            <span>{course.rating !== null ? course.rating : "N/A"} rating</span>
          </div>
          <div className="flex items-center gap-2 text-sm">
            <Users className="w-4 h-4 text-primary" />
            <span>{course.enrollment_count !== null ? formatNumber(course.enrollment_count) : 0} students</span>
          </div>
        </div>

        <div className="flex flex-wrap gap-2 mb-6">
          <span className="text-sm font-medium">Target Audience:</span>
          {course.target_audience.map((type) => (
            <Badge key={type} variant="outline" className="text-xs">
              {type}
            </Badge>
          ))}
        </div>

        {locked && (
          <div className="mb-4 rounded-lg border border-amber-200 bg-amber-50 p-4">
            <div className="flex items-center gap-2 mb-2 text-amber-800">
              <Lock className="w-4 h-4" />
              <span className="font-medium">Prerequisite{unmetPrereqs.length > 1 ? "s" : ""} required</span>
            </div>
            <p className="text-sm text-amber-800/80 mb-2">
              Complete the following course{unmetPrereqs.length > 1 ? "s" : ""} before enrolling:
            </p>
            <ul className="list-disc pl-6 space-y-1 text-sm text-amber-900">
              {unmetPrereqs.map((title) => (
                <li key={title} className="font-medium">{title}</li>
              ))}
            </ul>
          </div>
        )}

        <div className="flex items-center gap-4">
          <Button
            size="lg"
            className="gap-2 cursor-pointer"
            onClick={handleEnroll}
            disabled={!!enrollment || !course.is_active || locked}
          >
            {locked ? <Lock className="w-4 h-4" /> : <Play className="w-4 h-4" />}
            {enrollment ? "Enrolled" : locked ? "Locked" : "Start Learning"}
          </Button>
          <Button variant="outline" size="lg" disabled>
            Preview Course
          </Button>
        </div>

        {message && (
          <div className="mt-4 flex items-start gap-2 rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700">
            <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
            <span>{message}</span>
          </div>
        )}

        <div className="flex items-center gap-2 mt-4 text-sm text-muted-foreground">
          <Award className="w-4 h-4 text-primary" />
          <span>Certificate awarded upon course completion</span>
        </div>
      </div>

      <div className="relative">
        <Image
          src={course.thumbnail?.startsWith("http") || course.thumbnail?.startsWith("/") ? course.thumbnail : "/placeholder.svg"}
          alt={course.title}
          width={500}
          height={300}
          className="w-full h-64 object-cover rounded-lg shadow-lg"
          priority
        />
        <div className="absolute inset-0 bg-black/20 rounded-lg flex items-center justify-center">
          <Button size="lg" variant="secondary" className="gap-2" disabled>
            <Play className="w-5 h-5" />
            Preview
          </Button>
        </div>
      </div>
    </div>
  )
}