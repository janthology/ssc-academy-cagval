import { supabaseBrowser } from "@/lib/supabase/browser-client"

export type EnrollResult =
  | { ok: true; alreadyEnrolled?: boolean }
  | { ok: false; reason: "unauthenticated" | "prerequisites" | "no_content" | "error"; message: string }

/**
 * Enroll the current user in a course and seed lesson progress rows.
 * Mirrors the course-header flow so path enrollment stays consistent.
 */
export async function enrollInCourse(courseId: string): Promise<EnrollResult> {
  const { data: { user } } = await supabaseBrowser.auth.getUser()
  if (!user?.id) {
    return { ok: false, reason: "unauthenticated", message: "Please sign in to enroll." }
  }

  const { data: existing } = await supabaseBrowser
    .from("enrollments")
    .select("id")
    .eq("user_id", user.id)
    .eq("course_id", courseId)
    .maybeSingle()

  if (existing) {
    return { ok: true, alreadyEnrolled: true }
  }

  const { data: unmet, error: prereqError } = await supabaseBrowser.rpc(
    "get_unmet_prerequisites",
    { p_course_id: courseId }
  )
  if (prereqError) {
    return { ok: false, reason: "error", message: prereqError.message }
  }
  if (Array.isArray(unmet) && unmet.length > 0) {
    return {
      ok: false,
      reason: "prerequisites",
      message: `Complete these prerequisite course${unmet.length > 1 ? "s" : ""} first: ${unmet.join(", ")}`,
    }
  }

  const { data: modules, error: modulesError } = await supabaseBrowser
    .from("modules")
    .select(`
      id,
      course_id,
      lessons(id, module_id, title, order)
    `)
    .eq("course_id", courseId)
    .order("order", { ascending: true, foreignTable: "lessons" })

  if (modulesError) {
    return { ok: false, reason: "error", message: modulesError.message }
  }
  if (!modules || modules.length === 0) {
    return {
      ok: false,
      reason: "no_content",
      message: "This course doesn't have any published content yet. Please check back later.",
    }
  }

  const lessons = modules.flatMap((module) => module.lessons || [])
  const now = new Date().toISOString()

  const { error: rpcError } = await supabaseBrowser.rpc("enroll_and_track_progress", {
    enrollment_input: {
      user_id: user.id,
      course_id: courseId,
      status: "active",
      progress: 0,
      enrolled_at: now,
      last_accessed_at: now,
    },
    progress_inputs: lessons.map((lesson) => ({
      user_id: user.id,
      course_id: courseId,
      module_id: lesson.module_id,
      lesson_id: lesson.id,
      completed: false,
      time_spent: 0,
      completed_at: null,
    })),
  })

  if (rpcError) {
    return { ok: false, reason: "error", message: rpcError.message }
  }

  return { ok: true }
}
