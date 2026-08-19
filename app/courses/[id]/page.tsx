import { CourseDetailClient } from "@/components/courses/course-detail-client"
import type { Course } from "@/lib/types/database"

// Server shell: renders only the public, course-level meta (cacheable, anon).
// Per-user content (modules/lessons, enrollment, prerequisites, progress) lives
// in CourseDetailClient with the real session — never cached, so prerequisite
// enforcement and instructor-owner unpublished visibility are unchanged.
//
// The meta is read via a CACHED native fetch (next.revalidate) rather than
// supabase-js: supabase-js issues an uncached fetch, which would force the whole
// dynamic [id] route into per-request rendering (no-store). A cached fetch keeps
// it ISR — one render per course per 300s window, shared across users.
export const revalidate = 300

// Opt the dynamic [id] segment into static generation. Returning [] pre-renders
// nothing at build; each course is rendered on first request and then ISR-cached
// per `revalidate`. Without this, Next 15 renders the segment fully dynamic
// (no-store) even with a cached fetch. dynamicParams defaults to true, so unknown
// ids still render on demand.
export async function generateStaticParams() {
  return []
}

const COLS =
  "id,title,description,category,level,duration,thumbnail,rating,enrollment_count,target_audience,is_active,instructor,prerequisites"

async function getCourseMeta(id: string): Promise<Course | null> {
  const base = process.env.NEXT_PUBLIC_SUPABASE_URL!
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  const res = await fetch(
    `${base}/rest/v1/courses?id=eq.${encodeURIComponent(id)}&select=${COLS}`,
    {
      headers: { apikey: anon, Authorization: `Bearer ${anon}` },
      next: { revalidate: 300 },
    }
  )
  if (!res.ok) return null
  const rows = (await res.json()) as Course[]
  return rows[0] ?? null
}

export default async function CoursePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const course = await getCourseMeta(id)
  return <CourseDetailClient courseId={id} course={course} />
}
