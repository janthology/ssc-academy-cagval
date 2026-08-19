// app/dashboard/courses/page.tsx
import { DashboardHeader } from "@/components/dashboard/dashboard-header"
import { DashboardSidebar } from "@/components/dashboard/dashboard-sidebar"
import { EnrolledCourses } from "@/components/dashboard/enrolled-courses"
import { supabaseServer } from "@/lib/supabase/server-client"
import { Loader2 } from "lucide-react"
import type { User, Course, Enrollment, Certificate } from "@/lib/types/database"

export default async function DashboardCoursesPage() {
  const client = await supabaseServer()
  const { data: { user: authUser } } = await client.auth.getUser()

  // Loading state before data fetching
  if (!authUser) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="h-8 w-8 animate-spin mx-auto" />
          <p className="mt-2 text-muted-foreground">Loading your courses...</p>
        </div>
      </div>
    )
  }

  let user: User | null = null
  let enrolledCourses: any[] = []

  if (authUser?.email) {
    // Fetch user data
    const { data: userData, error: userError } = await client
      .from("users")
      .select("*")
      .eq("email", authUser.email)
      .single()
    if (userError) console.error("User query error:", userError)
    user = userData || null

    // Fetch enrollments with course and module details
    const { data: enrollments, error: enrollmentsError } = await client
      .from("enrollments")
      .select(`
        *,
        course:courses(
          *,
          modules!inner(
            id,
            course_id,
            title,
            order,
            estimated_duration,
            is_required,
            lessons(
              id,
              module_id,
              title,
              duration,
              order
            )
          )
        )
      `)
      .eq("user_id", user?.id)

    if (enrollmentsError) console.error("Enrollments query error:", enrollmentsError)

    // Fetch progress data
    const { data: progressData, error: progressError } = await client
      .from("progress")
      .select(`
        user_id,
        course_id,
        module_id,
        lesson_id,
        completed,
        time_spent,
        lesson:lessons(
          id,
          duration
        )
      `)
      .eq("user_id", user?.id)

    if (progressError) console.error("Progress query error:", progressError)

    // Fetch certificates
    const { data: certificates, error: certificatesError } = await client
      .from("certificates")
      .select("*")
      .eq("user_id", user?.id)
      .eq("status", "active")

    if (certificatesError) console.error("Certificates query error:", certificatesError)

    if (enrollments) {
      // Process enrolled courses data with accurate calculations
      enrolledCourses = enrollments.map((enrollment: Enrollment) => {
        const course = enrollment.course as Course
        // Ensure modules are sorted by order
        const sortedModules = (course?.modules || []).sort((a, b) => a.order - b.order);

        // Flatten lessons from all modules and sort them by module order then lesson order
        const allLessonsSorted = sortedModules.flatMap(module =>
          (module.lessons || []).map(lesson => ({ ...lesson, module_order: module.order }))
        ).sort((a, b) => {
          if (a.module_order !== b.module_order) {
            return a.module_order - b.module_order;
          }
          return a.order - b.order;
        });

        // Find progress entries for this course
        const courseProgress = progressData?.filter(p => p.course_id === enrollment.course_id) || []

        // Calculate completed lessons
        const completedLessons = courseProgress.filter(p => p.completed).length
        const totalLessons = allLessonsSorted.length

        // --- CORRECTED CALCULATION ---
        // Calculate time spent (in MINUTES) from progress.time_spent (also in MINUTES)
        // Then convert to hours for display
        const timeSpentMinutes = courseProgress
          ? courseProgress.reduce((sum: number, p: any) => sum + (p.time_spent || 0), 0)
          : 0
        const timeSpentHours = Number((timeSpentMinutes / 60).toFixed(1)) // Convert minutes to hours

        // Calculate remaining time (in MINUTES) from uncompleted lessons
        // lesson.duration is in MINUTES
        const remainingTimeMinutes = allLessonsSorted.reduce((sum: number, lesson: any) => {
          const lessonProgress = courseProgress.find(p => p.lesson_id === lesson.id)
          if (!lessonProgress || !lessonProgress.completed) {
            return sum + (lesson.duration || 0) // Already in minutes
          }
          return sum
        }, 0)
        // Convert remaining time to hours for display
        const remainingTimeHours = Number((remainingTimeMinutes / 60).toFixed(1))

        // --- CORRECTED NEXT LESSON LOGIC ---
        let nextLessonTitle = "Course completed";
        if (enrollment.status !== "completed") {
          // Find completed lesson IDs for this course
          const completedLessonIds = new Set(
            courseProgress.filter(p => p.completed).map(p => p.lesson_id)
          );

          // Find the first uncompleted lesson across all sorted lessons
          const nextLesson = allLessonsSorted.find(lesson => !completedLessonIds.has(lesson.id));

          if (nextLesson) {
            nextLessonTitle = nextLesson.title;
          } else {
            // Fallback if somehow no uncompleted lesson is found but status isn't completed
            nextLessonTitle = "Next Lesson";
          }
        }

        // Check if user has certificate for this course
        const certificate = certificates?.find((cert: Certificate) => cert.course_id === enrollment.course_id)

        return {
          id: enrollment.course_id,
          title: course?.title || "Unknown Course",
          instructor: course?.instructor || "Unknown Instructor",
          progress: enrollment.progress || 0,
          status: enrollment.status === "completed" ? "Completed" : "In Progress",
          nextLesson: nextLessonTitle,
          // Format time values correctly
          timeSpent: `${timeSpentHours} hours`,
          estimatedTime: `${remainingTimeHours} hours`,
          lastAccessed: enrollment.last_accessed_at,
          rating: course?.rating || 0,
          image: course?.thumbnail || "/placeholder.svg",
          completed_at: enrollment.completed_at || undefined,
          certificateId: certificate?.id || null,
          lessonsCompleted: `${completedLessons}/${totalLessons}`,
        }
      })
    }
  }

  return (
    <div className="min-h-screen bg-background">
      <DashboardHeader />
      <div className="flex">
        <DashboardSidebar />
        <main className="flex-1 p-6">
          <EnrolledCourses
            enrolledCourses={enrolledCourses}
            user={user}
          />
        </main>
      </div>
    </div>
  )
}