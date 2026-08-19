import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Clock, BookOpen, Users, Star } from "lucide-react"
import Link from "next/link"
import Image from "next/image"
import type { Course } from "@/lib/types/database"

interface CourseCardProps {
  course: Course
}

export function CourseCard({ course }: CourseCardProps) {
  return (
    <Card className="hover:shadow-lg transition-shadow">
      <div className="relative">
        <Image
          src={course.thumbnail?.startsWith("http") || course.thumbnail?.startsWith("/") ? course.thumbnail : "/placeholder.svg"}
          alt={course.title}
          width={300}
          height={200}
          className="w-full h-48 object-cover rounded-t-lg"
          sizes="(max-width: 768px) 100vw, (max-width: 1024px) 50vw, 33vw"
        />
        <Badge className="absolute top-3 left-3" variant="default">
          {course.level}
        </Badge>
        <Badge className="absolute top-3 right-3" variant="secondary">
          {course.category}
        </Badge>
      </div>

      <CardHeader>
        <CardTitle className="text-lg">{course.title}</CardTitle>
        <CardDescription className="line-clamp-2">{course.description}</CardDescription>
      </CardHeader>

      <CardContent className="space-y-4">
        <div className="flex items-center gap-4 text-sm text-muted-foreground">
          <div className="flex items-center gap-1">
            <Clock className="w-4 h-4" />
            {course.duration} hours
          </div>
          <div className="flex items-center gap-1">
            <BookOpen className="w-4 h-4" />
            {course.modules?.length || 0} modules
          </div>
        </div>

        <div className="flex items-center gap-4 text-sm">
          <div className="flex items-center gap-1">
            <Star className="w-4 h-4 fill-yellow-400 text-yellow-400" />
            {course.rating !== null ? course.rating : "N/A"}
          </div>
          <div className="flex items-center gap-1 text-muted-foreground">
            <Users className="w-4 h-4" />
            {course.enrollment_count !== null ? course.enrollment_count.toLocaleString() : 0} students
          </div>
        </div>

        <div className="flex flex-wrap gap-1">
          {course.target_audience.map((type) => (
            <Badge key={type} variant="outline" className="text-xs">
              {type}
            </Badge>
          ))}
        </div>

        <div className="flex items-center justify-between pt-2">
          <p className="text-sm text-muted-foreground">by {course.instructor}</p>
          <Button asChild>
            <Link href={`/courses/${course.id}`}>View Course</Link>
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}