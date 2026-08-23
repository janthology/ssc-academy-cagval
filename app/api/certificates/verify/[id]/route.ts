import { NextResponse } from "next/server"
import { supabaseAdmin } from "@/lib/supabase/admin-client"
import { supabasePublic } from "@/lib/supabase/public-client"

// Public certificate verification.
// Prefer SECURITY DEFINER RPC (anon-safe, no service role). Fall back to
// sequential service-role lookups if the RPC is not yet deployed.
//
// Returns only a minimal field set: recipient name, course title, completion
// date, certificate number. Never grade, organization, region, hash, or email.
//
// status: valid | revoked | not_found | error

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

type VerifyRow = {
  status: string
  recipient_name?: string | null
  course_title?: string | null
  completion_date?: string | null
  certificate_number?: string | null
}

function validPayload(row: VerifyRow) {
  return NextResponse.json({
    status: "valid",
    certificate: {
      recipientName: row.recipient_name ?? "Unknown Recipient",
      courseTitle: row.course_title ?? "Unknown Course",
      completionDate: row.completion_date ?? null,
      certificateNumber: row.certificate_number ?? null,
    },
  })
}

async function verifyViaRpc(id: string): Promise<NextResponse | null> {
  const { data, error } = await supabasePublic.rpc("verify_certificate", { p_id: id })

  if (error) {
    // RPC not deployed yet — let caller try the admin fallback.
    const missing =
      error.code === "PGRST202" ||
      /could not find the function|schema cache/i.test(error.message ?? "")
    if (missing) return null

    console.error("verify_certificate RPC error:", error.message, error.code)
    return NextResponse.json({ status: "error" }, { status: 500 })
  }

  const row = (Array.isArray(data) ? data[0] : data) as VerifyRow | undefined
  if (!row) {
    return NextResponse.json({ status: "not_found" }, { status: 404 })
  }

  if (row.status === "revoked") {
    return NextResponse.json({ status: "revoked" })
  }

  if (row.status !== "valid") {
    return NextResponse.json({ status: "not_found" }, { status: 404 })
  }

  return validPayload(row)
}

async function verifyViaAdmin(id: string): Promise<NextResponse> {
  const admin = supabaseAdmin()

  // Avoid PostgREST relationship embeds — live FK metadata can differ from
  // migrations and cause 500s. Fetch certificate, then user/course by id.
  const { data: cert, error: certError } = await admin
    .from("certificates")
    .select("status, issued_at, certificate_number, user_id, course_id")
    .eq("id", id)
    .maybeSingle()

  if (certError) {
    console.error("certificate verify admin select error:", certError.message)
    return NextResponse.json({ status: "error" }, { status: 500 })
  }

  if (!cert) {
    return NextResponse.json({ status: "not_found" }, { status: 404 })
  }

  if (cert.status === "revoked") {
    return NextResponse.json({ status: "revoked" })
  }

  if (cert.status !== "active") {
    return NextResponse.json({ status: "not_found" }, { status: 404 })
  }

  const [{ data: user }, { data: course }] = await Promise.all([
    admin.from("users").select("name").eq("id", cert.user_id).maybeSingle(),
    admin.from("courses").select("title").eq("id", cert.course_id).maybeSingle(),
  ])

  return validPayload({
    status: "valid",
    recipient_name: user?.name,
    course_title: course?.title,
    completion_date: cert.issued_at,
    certificate_number: cert.certificate_number,
  })
}

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params

  if (!id || !UUID_REGEX.test(id)) {
    return NextResponse.json({ status: "not_found" }, { status: 404 })
  }

  try {
    const rpcResult = await verifyViaRpc(id)
    if (rpcResult) return rpcResult
    return await verifyViaAdmin(id)
  } catch (err) {
    console.error("certificate verify fatal:", err instanceof Error ? err.message : err)
    return NextResponse.json({ status: "error" }, { status: 500 })
  }
}
