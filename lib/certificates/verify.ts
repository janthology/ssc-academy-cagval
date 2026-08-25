import { NextResponse } from "next/server"
import { UUID_REGEX } from "@/lib/certificates/constants"
import { supabaseAdmin } from "@/lib/supabase/admin-client"
import { supabasePublic } from "@/lib/supabase/public-client"

// Public certificate verification by UUID or printed certificate_number.
// Prefer SECURITY DEFINER RPC (anon-safe). Fall back to sequential service-role
// lookups if the RPC is not yet deployed.
//
// Query: GET /api/certificates/verify?ref=<uuid-or-certificate-number>
// Also:  GET /api/certificates/verify/[id] (deep links; UUID preferred)
//
// Returns only: recipient name, course title, completion date, certificate number.
// status: valid | revoked | not_found | error

export { UUID_REGEX }

export type VerifyRow = {
  status: string
  recipient_name?: string | null
  course_title?: string | null
  completion_date?: string | null
  certificate_number?: string | null
  certificate_id?: string | null
}

export function validPayload(row: VerifyRow) {
  return NextResponse.json({
    status: "valid",
    certificate: {
      id: row.certificate_id ?? null,
      recipientName: row.recipient_name ?? "Unknown Recipient",
      courseTitle: row.course_title ?? "Unknown Course",
      completionDate: row.completion_date ?? null,
      certificateNumber: row.certificate_number ?? null,
    },
  })
}

function isMissingRpc(error: { code?: string; message?: string }) {
  return (
    error.code === "PGRST202" ||
    /could not find the function|schema cache/i.test(error.message ?? "")
  )
}

export async function verifyViaLookupRpc(ref: string): Promise<NextResponse | null> {
  const { data, error } = await supabasePublic.rpc("verify_certificate_lookup", {
    p_ref: ref,
  })

  if (error) {
    if (isMissingRpc(error)) return null
    console.error("verify_certificate_lookup RPC error:", error.message, error.code)
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

export async function verifyViaUuidRpc(id: string): Promise<NextResponse | null> {
  const { data, error } = await supabasePublic.rpc("verify_certificate", { p_id: id })

  if (error) {
    if (isMissingRpc(error)) return null
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

  return validPayload({ ...row, certificate_id: id })
}

export async function verifyViaAdmin(ref: string): Promise<NextResponse> {
  const admin = supabaseAdmin()
  const trimmed = ref.trim()
  const byUuid = UUID_REGEX.test(trimmed)

  const { data: cert, error: certError } = await admin
    .from("certificates")
    .select("id, status, issued_at, certificate_number, user_id, course_id")
    .eq(byUuid ? "id" : "certificate_number", trimmed)
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

  const [{ data: user }, { data: course }, { data: prefs }] = await Promise.all([
    admin.from("users").select("name").eq("id", cert.user_id).maybeSingle(),
    admin.from("courses").select("title").eq("id", cert.course_id).maybeSingle(),
    admin
      .from("user_preferences")
      .select("privacy_certificate_verification")
      .eq("user_id", cert.user_id)
      .maybeSingle(),
  ])

  if (prefs && prefs.privacy_certificate_verification === false) {
    return NextResponse.json({ status: "not_found" }, { status: 404 })
  }

  return validPayload({
    status: "valid",
    recipient_name: user?.name,
    course_title: course?.title,
    completion_date: cert.issued_at,
    certificate_number: cert.certificate_number,
    certificate_id: cert.id,
  })
}

export async function verifyCertificateRef(ref: string): Promise<NextResponse> {
  const trimmed = ref.trim()
  if (!trimmed) {
    return NextResponse.json({ status: "not_found" }, { status: 404 })
  }

  const lookup = await verifyViaLookupRpc(trimmed)
  if (lookup) return lookup

  if (UUID_REGEX.test(trimmed)) {
    const byId = await verifyViaUuidRpc(trimmed)
    if (byId) return byId
  }

  return verifyViaAdmin(trimmed)
}
