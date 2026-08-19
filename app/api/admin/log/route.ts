import { NextResponse } from "next/server"
import { requireAdmin } from "@/lib/auth/api-auth"
import { logAdminAction } from "@/lib/admin/log"

// Records an admin action into admin_logs. The admin id is taken from the
// verified session (never the client body), so a caller cannot forge who acted.
export async function POST(request: Request) {
  const { error, profile } = await requireAdmin()
  if (error) return error

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: "invalid body" }, { status: 400 })
  }

  const { action, targetId, details } = (body ?? {}) as {
    action?: unknown
    targetId?: unknown
    details?: unknown
  }
  if (typeof action !== "string" || !action.trim()) {
    return NextResponse.json({ error: "action required" }, { status: 400 })
  }

  await logAdminAction(
    profile!.id,
    action,
    typeof targetId === "string" ? targetId : null,
    details && typeof details === "object" ? (details as Record<string, unknown>) : null
  )

  return NextResponse.json({ ok: true })
}
