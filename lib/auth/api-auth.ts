import { NextResponse } from "next/server"
import { supabaseServer } from "@/lib/supabase/server-client"

export interface AuthProfile {
  id: string
  is_admin: boolean
  status: string | null
}

export async function getAuthenticatedUser() {
  const supabase = await supabaseServer()
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser()

  if (error || !user) {
    return null
  }

  return user
}

export async function getUserProfile(userId: string): Promise<AuthProfile | null> {
  const supabase = await supabaseServer()
  const { data, error } = await supabase
    .from("users")
    .select("id, is_admin, status")
    .eq("id", userId)
    .single()

  if (error || !data) {
    return null
  }

  return data as AuthProfile
}

export async function requireAuth() {
  const user = await getAuthenticatedUser()

  if (!user) {
    return {
      error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }),
      user: null,
      profile: null,
    }
  }

  const profile = await getUserProfile(user.id)

  if (!profile) {
    return {
      error: NextResponse.json({ error: "User profile not found" }, { status: 404 }),
      user: null,
      profile: null,
    }
  }

  return { error: null, user, profile }
}

export async function requireAdmin() {
  const result = await requireAuth()

  if (result.error) {
    return result
  }

  if (!result.profile?.is_admin) {
    return {
      error: NextResponse.json({ error: "Forbidden" }, { status: 403 }),
      user: null,
      profile: null,
    }
  }

  return result
}

export function forbiddenUnlessSelfOrAdmin(
  requestedUserId: string,
  authUserId: string,
  isAdmin: boolean
) {
  if (requestedUserId !== authUserId && !isAdmin) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  return null
}
