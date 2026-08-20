import type { LearningPath } from "@/lib/types/database"

export type CourseInPath = {
  id: string
  title: string
  course_order: number
  level: string
  duration: number
  progress: number
}

export type LearningPathWithProgress = Omit<LearningPath, "courses"> & {
  progress: number
  courseCount: number
  durationHours: number
  courses: CourseInPath[]
  isMock?: boolean
}

type RawPath = {
  id: string
  title: string
  description: string
  target_audience: string[]
  status: "active" | "archived"
  created_at: string
  updated_at: string
  created_by: string
  learningpath_courses?: {
    course_id: string
    course_order: number
    courses: {
      id: string
      title: string
      level: string
      duration: number
    } | null
  }[]
}

export function mapLearningPaths(
  pathsData: RawPath[],
  enrollments: { course_id: string; progress: number; status: string }[] = []
): LearningPathWithProgress[] {
  return (pathsData || []).map((path) => {
    const courses: CourseInPath[] = (path.learningpath_courses || [])
      .map((lc) => ({
        id: lc.course_id,
        title: lc.courses?.title || "Untitled",
        course_order: lc.course_order,
        level: lc.courses?.level || "beginner",
        duration: lc.courses?.duration || 0,
        progress: enrollments.find((e) => e.course_id === lc.course_id)?.progress || 0,
      }))
      .sort((a, b) => a.course_order - b.course_order)

    const courseCount = courses.length
    const totalProgress = courses.reduce((sum, course) => sum + course.progress, 0)
    const progress = courseCount > 0 ? Math.round(totalProgress / courseCount) : 0
    const durationHours = courses.reduce((sum, course) => sum + (course.duration || 0), 0)

    return {
      id: path.id,
      title: path.title,
      description: path.description,
      target_audience: path.target_audience,
      status: path.status,
      created_at: path.created_at,
      updated_at: path.updated_at,
      created_by: path.created_by,
      courses,
      progress,
      courseCount,
      durationHours,
      isMock: false,
    }
  })
}

const PATH_SELECT =
  "id,title,description,target_audience,status,created_at,updated_at,created_by,learningpath_courses(course_id,course_order,courses(id,title,level,duration))"

/** Public active learning paths via cached Rest fetch (ISR-safe). */
export async function fetchPublicLearningPaths(): Promise<LearningPathWithProgress[]> {
  const base = process.env.NEXT_PUBLIC_SUPABASE_URL!
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  const res = await fetch(
    `${base}/rest/v1/learningpaths?status=eq.active&select=${encodeURIComponent(PATH_SELECT)}&order=title.asc`,
    {
      headers: { apikey: anon, Authorization: `Bearer ${anon}` },
      next: { revalidate: 300 },
    }
  )
  if (!res.ok) return []
  const rows = (await res.json()) as RawPath[]
  return mapLearningPaths(rows)
}
