import { supabaseAdmin } from "@/lib/supabase/admin-client"

/**
 * Write an admin activity row (service-role, bypasses RLS). Best-effort: logging
 * must never break the mutation it records, so failures are swallowed + logged.
 * Server-only — call it from a route handler that has already verified the admin.
 */
export async function logAdminAction(
  adminId: string,
  action: string,
  targetId?: string | null,
  details?: Record<string, unknown> | null
) {
  try {
    const admin = supabaseAdmin()
    const { error } = await admin.from("admin_logs").insert({
      admin_id: adminId,
      action,
      target_id: targetId ?? null,
      details: details ?? null,
    })
    if (error) console.error("logAdminAction insert failed:", error.message)
  } catch (e) {
    console.error("logAdminAction failed:", e)
  }
}
