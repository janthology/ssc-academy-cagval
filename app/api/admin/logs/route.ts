import { NextResponse } from "next/server"
import { requireAdmin } from "@/lib/auth/api-auth"
import { supabaseAdmin } from "@/lib/supabase/admin-client"

export async function GET(request: Request) {
  const { error } = await requireAdmin()
  if (error) {
    return error
  }

  // Optional ?limit — defaults to 4 (the dashboard "recent activity" widget);
  // the full /admin/logs page requests more. Capped to keep the payload sane.
  const limitParam = Number(new URL(request.url).searchParams.get("limit"))
  const limit = Number.isFinite(limitParam) && limitParam > 0 ? Math.min(limitParam, 200) : 4

  try {
    const admin = supabaseAdmin()
    const { data: logs, error: logsError } = await admin
      .from("admin_logs")
      .select(`
        id,
        action,
        target_id,
        details,
        created_at,
        admin_id,
        users!admin_id(name)
      `)
      .order("created_at", { ascending: false })
      .limit(limit)

    if (logsError) {
      return NextResponse.json({ error: logsError.message }, { status: 500 })
    }

    const activity =
      logs?.map((log) => {
        const userRecord = Array.isArray(log.users) ? log.users[0] : log.users
        const timeDiff = Math.round(
          (Date.now() - new Date(log.created_at).getTime()) / 1000 / 60
        )
        const time =
          timeDiff < 60 ? `${timeDiff} minutes ago` : `${Math.floor(timeDiff / 60)} hours ago`

        let message = ""
        switch (log.action) {
          case "user_updated":
            message = `User updated by ${userRecord?.name || "Admin"}`
            break
          case "course_created":
            message = `New course created: ${log.details?.data?.title || "Untitled"}`
            break
          case "certificate_revoked":
            message = `Certificate revoked (ID: ${log.target_id})`
            break
          default:
            message = log.details?.message || log.action
        }

        return {
          type: log.action,
          message,
          time,
        }
      }) ?? []

    return NextResponse.json({ activity })
  } catch (err) {
    console.error("Admin logs error:", err)
    return NextResponse.json({ error: "Failed to fetch admin logs" }, { status: 500 })
  }
}
