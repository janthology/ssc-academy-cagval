import { CatalogClient } from "@/components/courses/catalog-client"
import { supabasePublic } from "@/lib/supabase/public-client"
import type { Course } from "@/lib/types/database"

// Public catalog is server-rendered and cached (ISR). The data is anon-only and
// identical for everyone, so it is safe to cache. New courses appear within the
// window, or immediately via revalidatePath('/courses') from the admin create
// action. The cookieless supabasePublic client keeps this route static.
export const revalidate = 300

async function getInitialCourses(): Promise<Course[]> {
  const { data } = await supabasePublic
    .from("courses")
    .select(
      "id,title,description,level,category,duration,thumbnail,rating,enrollment_count,target_audience,instructor,modules!course_id(id)"
    )
    .eq("is_active", true)
  return (data ?? []) as unknown as Course[]
}

export default async function CoursesPage() {
  const initialCourses = await getInitialCourses()
  return <CatalogClient initialCourses={initialCourses} />
}
