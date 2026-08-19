import { createHash } from "crypto"
import { NextResponse } from "next/server"
import { v4 as uuidv4 } from "uuid"
import { requireAuth } from "@/lib/auth/api-auth"
import { supabaseAdmin } from "@/lib/supabase/admin-client"
import { supabaseServer } from "@/lib/supabase/server-client"

export async function POST(request: Request) {
  const { error, user } = await requireAuth()
  if (error) {
    return error
  }

  try {
    const body = await request.json()
    const courseId = body?.courseId as string | undefined

    if (!courseId) {
      return NextResponse.json({ error: "courseId is required" }, { status: 400 })
    }

    const supabase = await supabaseServer()

    const { data: existingCertificate } = await supabase
      .from("certificates")
      .select("id, certificate_number")
      .eq("user_id", user!.id)
      .eq("course_id", courseId)
      .eq("status", "active")
      .maybeSingle()

    if (existingCertificate) {
      return NextResponse.json({
        certificate: existingCertificate,
        alreadyExists: true,
      })
    }

    const { data: enrollment, error: enrollmentError } = await supabase
      .from("enrollments")
      .select("progress, status")
      .eq("user_id", user!.id)
      .eq("course_id", courseId)
      .single()

    if (enrollmentError || !enrollment) {
      return NextResponse.json({ error: "Enrollment not found" }, { status: 404 })
    }

    if (enrollment.progress < 100) {
      return NextResponse.json({ error: "Course not completed" }, { status: 400 })
    }

    const { data: modules, error: modulesError } = await supabase
      .from("modules")
      .select("id")
      .eq("course_id", courseId)

    if (modulesError) {
      return NextResponse.json({ error: modulesError.message }, { status: 500 })
    }

    const moduleIds = modules?.map((module) => module.id) ?? []

    if (moduleIds.length === 0) {
      return NextResponse.json({ error: "Course has no modules" }, { status: 400 })
    }

    const { count: totalLessons, error: totalLessonsError } = await supabase
      .from("lessons")
      .select("id", { count: "exact", head: true })
      .in("module_id", moduleIds)

    if (totalLessonsError) {
      return NextResponse.json({ error: totalLessonsError.message }, { status: 500 })
    }

    // A lesson-less course cannot be "completed" — block issuance with an honest,
    // distinct message rather than the misleading "Not all lessons completed"
    // that the falsy `!totalLessons` check below would otherwise produce.
    if (totalLessons === 0) {
      return NextResponse.json(
        { error: "This course has no lesson content yet; a certificate cannot be issued until content exists." },
        { status: 400 }
      )
    }

    const { count: completedLessons, error: completedLessonsError } = await supabase
      .from("progress")
      .select("id", { count: "exact", head: true })
      .eq("user_id", user!.id)
      .eq("course_id", courseId)
      .eq("completed", true)
      .not("lesson_id", "is", null)

    if (completedLessonsError) {
      return NextResponse.json({ error: completedLessonsError.message }, { status: 500 })
    }

    if (!totalLessons || !completedLessons || completedLessons < totalLessons) {
      return NextResponse.json({ error: "Not all lessons completed" }, { status: 400 })
    }

    const certificateNumber = `DOST02SSCP-${uuidv4()}`
    const verificationHash = createHash("sha256")
      .update(`${user!.id}-${courseId}-${Date.now()}`)
      .digest("hex")

    const admin = supabaseAdmin()
    const { data: certificate, error: insertError } = await admin
      .from("certificates")
      .insert({
        user_id: user!.id,
        course_id: courseId,
        certificate_number: certificateNumber,
        verification_hash: verificationHash,
        status: "active",
        issued_at: new Date().toISOString(),
      })
      .select("id, certificate_number")
      .single()

    if (insertError) {
      return NextResponse.json({ error: insertError.message }, { status: 500 })
    }

    return NextResponse.json({ certificate })
  } catch (err) {
    console.error("Certificate issue error:", err)
    return NextResponse.json({ error: "Failed to issue certificate" }, { status: 500 })
  }
}
