import { NextResponse } from "next/server"
import { supabaseServer } from "@/lib/supabase/server-client"

// Returns the current signed-in user's display profile for the client UI.
// NOTE: This is display/UX state only. Authorization gates remain in middleware/RLS.
export async function GET() {
  try {
    const supabase = await supabaseServer()

    const { data: userData, error: userErr } = await supabase.auth.getUser()
    if (userErr) {
      return NextResponse.json({ profile: null }, { status: 200 })
    }

    const user = userData?.user
    if (!user) {
      return NextResponse.json({ profile: null }, { status: 200 })
    }

    const { data, error } = await supabase
      .from("users")
      .select("id,name,email,avatar,user_type,is_admin,is_instructor,status,organization_id")
      .eq("id", user.id)
      .single()

    if (error) {
      return NextResponse.json({ profile: null }, { status: 200 })
    }

    return NextResponse.json({ profile: data }, { status: 200 })
  } catch {
    // If server-side Supabase connectivity fails, surface it so the UI can
    // show a recoverable error (instead of silently treating the user as signed out).
    return NextResponse.json({ profile: null }, { status: 503 })
  }
}

