import { DashboardHeader } from "@/components/dashboard/dashboard-header";
import { DashboardSidebar } from "@/components/dashboard/dashboard-sidebar";
import { DashboardContent } from "@/components/dashboard/dashboard-content";
import { supabaseServer } from "@/lib/supabase/server-client";
import { Loader2 } from "lucide-react";
import type { User, Course, Enrollment, Certificate, Event } from "@/lib/types/database";

interface LearningPathProgress {
  id: string;
  title: string;
  totalCourses: number;
  completedCourses: number;
  inProgressCourses: number;
  progress: number;
}

export default async function DashboardPage() {
  const client = await supabaseServer();
  const { data: { user: authUser } } = await client.auth.getUser();

  if (!authUser) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="h-8 w-8 animate-spin mx-auto" />
          <p className="mt-2 text-muted-foreground">Loading your dashboard...</p>
        </div>
      </div>
    );
  }

  let user: User | null = null;
  let stats = { coursesEnrolled: 0, certificatesEarned: 0, learningHours: 0, progressScore: 0 };
  let recentCourses: Partial<Course & { progress: number; nextLesson: string; timeLeft: string; image: string; completed_at?: string }>[] = [];
  let learningPath: LearningPathProgress | null = null;
  type UpcomingEvent = Pick<Event, "id" | "title" | "event_type" | "starts_at" | "ends_at" | "location">;
  let upcomingEvents: UpcomingEvent[] = [];

  if (authUser?.email) {
    const { data: userData, error: userError } = await client
      .from("users")
      .select("*")
      .eq("email", authUser.email)
      .single();

    if (userError) {
      console.error("User query error:", userError);
    } else {
      user = userData as User;
    }

    // Fetch enrollments with course and module details
    const enrollmentsQueryResult = await client
      .from("enrollments")
      .select(`
        *,
        course:courses(
          *,
          modules(
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
      .eq("user_id", user?.id);

    let enrollments: (Enrollment & { course?: Course | null })[] | null = null;
    if (enrollmentsQueryResult.error) {
      console.error("Enrollments query error:", enrollmentsQueryResult.error);
      enrollments = [];
    } else {
      enrollments = (enrollmentsQueryResult.data as unknown) as (Enrollment & { course?: Course | null })[];
    }

    // Fetch progress data to calculate learning hours and time left
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
      .eq("user_id", user?.id);
    if (progressError) console.error("Progress query error:", progressError);

    // Fetch learning paths and associated courses
    const { data: pathsData, error: pathsError } = await client
      .from("learningpaths")
      .select(`
        id,
        title,
        learningpath_courses (
          course_id
        )
      `)
      .eq("status", "active");

    if (pathsError) {
      console.error("Learning paths query error:", pathsError);
    } else if (enrollments && enrollments.length > 0) {
      const enrolledCourseIds = new Set(enrollments.map(e => e.course_id));
      // Find the first learning path that contains at least one enrolled course
      const activePath = pathsData?.find(path =>
        path.learningpath_courses.some((lc: any) => enrolledCourseIds.has(lc.course_id))
      );

      if (activePath) {
        const totalCourses = activePath.learningpath_courses.length;
        const completedCourses = enrollments.filter(e =>
          enrolledCourseIds.has(e.course_id) &&
          activePath.learningpath_courses.some((lc: any) => lc.course_id === e.course_id) &&
          e.status === "completed"
        ).length;
        const inProgressCourses = enrollments.filter(e =>
          enrolledCourseIds.has(e.course_id) &&
          activePath.learningpath_courses.some((lc: any) => lc.course_id === e.course_id) &&
          e.status === "active" && e.progress < 100
        ).length;
        const totalProgress = enrollments
          .filter(e => activePath.learningpath_courses.some((lc: any) => lc.course_id === e.course_id))
          .reduce((sum, e) => sum + (e.progress || 0), 0);
        const progress = totalCourses > 0 ? Math.round(totalProgress / totalCourses) : 0;

        learningPath = {
          id: activePath.id,
          title: activePath.title,
          totalCourses,
          completedCourses,
          inProgressCourses,
          progress
        };
      }
    }

    // Upcoming events — platform-wide announcements, soonest three. Not
    // user-specific, but fetched here so the widget follows the same
    // server-fetch-then-prop pattern as everything else on this page.
    const { data: eventsData, error: eventsError } = await client
      .from("events")
      .select("id,title,event_type,starts_at,ends_at,location")
      .eq("is_published", true)
      .gte("starts_at", new Date().toISOString())
      .order("starts_at", { ascending: true })
      .limit(3);
    if (eventsError) console.error("Events query error:", eventsError);
    upcomingEvents = (eventsData ?? []) as UpcomingEvent[];

    if (enrollments && enrollments.length > 0) {
      const activeEnrollments = enrollments.filter((e: Enrollment & { course?: Course | null }) => ["active", "completed"].includes(e.status));
      const activeCount = enrollments.filter((e: Enrollment & { course?: Course | null }) => e.status === "active").length;
      const completedCount = enrollments.filter((e: Enrollment & { course?: Course | null }) => e.status === "completed").length;

      const { data: certificates, error: certificatesError } = await client
        .from("certificates")
        .select("*")
        .eq("user_id", user?.id)
        .eq("status", "active");
      if (certificatesError) console.error("Certificates query error:", certificatesError);

      const totalLearningMinutes = progressData
        ? progressData.reduce((sum: number, p: any) => sum + (p.time_spent || 0), 0)
        : 0;
      const learningHours = Number((totalLearningMinutes / 60).toFixed(1));

      stats = {
        coursesEnrolled: activeEnrollments.length,
        certificatesEarned: certificates?.length || 0,
        learningHours,
        progressScore: activeEnrollments.length > 0
          ? Number((activeEnrollments.reduce((sum: number, e: Enrollment & { course?: Course | null }) => sum + (e.progress || 0), 0) / activeEnrollments.length).toFixed(0))
          : 0,
      };

      recentCourses = activeEnrollments.map((e: Enrollment & { course?: Course | null }) => {
        const course = e.course as Course | undefined;
        if (!course) {
          return {
            id: e.course_id,
            title: "Unknown Course",
            progress: e.progress || 0,
            nextLesson: e.status === "completed" ? "Course completed" : "Next Lesson",
            timeLeft: "0 hours",
            image: "/placeholder.svg",
            completed_at: e.completed_at || undefined,
          };
        }

        const sortedModules = (course?.modules || []).sort((a, b) => a.order - b.order);
        const allLessonsSorted = sortedModules.flatMap(module =>
          (module.lessons || []).map(lesson => ({ ...lesson, module_order: module.order }))
        ).sort((a, b) => {
          if (a.module_order !== b.module_order) {
            return a.module_order - b.module_order;
          }
          return a.order - b.order;
        });

        const courseProgress = progressData?.filter(p => p.course_id === e.course_id) || [];
        const remainingTimeMinutes = allLessonsSorted.reduce((sum: number, lesson: any) => {
          const lessonProgress = courseProgress.find(p => p.lesson_id === lesson.id);
          if (!lessonProgress || !lessonProgress.completed) {
            return sum + (lesson.duration || 0);
          }
          return sum;
        }, 0);
        const remainingTimeHours = Number((remainingTimeMinutes / 60).toFixed(1));

        let nextLessonTitle = "Next Lesson";
        if (e.status !== "completed") {
          const completedLessonIds = new Set(
            courseProgress.filter(p => p.completed).map(p => p.lesson_id)
          );
          const nextLesson = allLessonsSorted.find(lesson => !completedLessonIds.has(lesson.id));
          if (nextLesson) {
            nextLessonTitle = nextLesson.title;
          }
        } else {
          nextLessonTitle = "Course completed";
        }

        return {
          id: e.course_id,
          title: course?.title || "Unknown Course",
          progress: e.progress || 0,
          nextLesson: nextLessonTitle,
          timeLeft: `${remainingTimeHours} hours`,
          image: course?.thumbnail || "/placeholder.svg",
          completed_at: e.completed_at || undefined,
        };
      });

      const safeCertificates: Certificate[] = certificates || [];
      return (
        <div className="min-h-screen bg-background">
          <DashboardHeader />
          <div className="flex">
            <DashboardSidebar />
            <main className="flex-1 p-6">
              <DashboardContent
                user={user}
                stats={stats}
                recentCourses={recentCourses}
                activeCount={activeCount}
                completedCount={completedCount}
                certificates={safeCertificates}
                learningPath={learningPath}
                upcomingEvents={upcomingEvents}
              />
            </main>
          </div>
        </div>
      );
    }

    return (
      <div className="min-h-screen bg-background">
        <DashboardHeader />
        <div className="flex">
          <DashboardSidebar />
          <main className="flex-1 p-6">
            <DashboardContent
              user={user}
              stats={stats}
              recentCourses={recentCourses}
              learningPath={learningPath}
              upcomingEvents={upcomingEvents}
            />
          </main>
        </div>
      </div>
    );
  }
}