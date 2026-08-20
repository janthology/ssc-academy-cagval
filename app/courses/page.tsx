import { CatalogClient } from "@/components/courses/catalog-client"
import type { Course } from "@/lib/types/database"

// Public catalog is server-rendered and ISR-cached. Use a native Rest fetch with
// next.revalidate — supabase-js issues uncached fetches that defeat ISR (same
// pattern as app/courses/[id]/page.tsx).
export const revalidate = 300

const COLS =
  "id,title,description,level,category,duration,thumbnail,rating,enrollment_count,target_audience,instructor,modules!course_id(id)"

async function getInitialCourses(): Promise<Course[]> {
  const base = process.env.NEXT_PUBLIC_SUPABASE_URL!
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  const res = await fetch(
    `${base}/rest/v1/courses?is_active=eq.true&select=${encodeURIComponent(COLS)}`,
    {
      headers: { apikey: anon, Authorization: `Bearer ${anon}` },
      next: { revalidate: 300 },
    }
  )
  if (!res.ok) return []
  return (await res.json()) as Course[]
}

export default async function CoursesPage() {
  const initialCourses = await getInitialCourses()
  return <CatalogClient initialCourses={initialCourses} />
}
