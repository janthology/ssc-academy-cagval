/**
 * Fire-and-forget admin action logging from client components. Posts to
 * /api/admin/log, which verifies the admin server-side and writes the row with
 * the service role. Best-effort — never blocks or fails the mutation it follows.
 */
export function recordAdminAction(
  action: string,
  targetId?: string | null,
  details?: Record<string, unknown>
) {
  fetch("/api/admin/log", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ action, targetId: targetId ?? null, details: details ?? null }),
  }).catch(() => {})
}
