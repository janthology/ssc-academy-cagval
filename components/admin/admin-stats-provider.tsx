"use client"

import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react"
import { supabaseBrowser } from "@/lib/supabase/browser-client"

export type RegionalStat = { province: string; users: number }

export type AdminStats = {
  userCount: number
  courseCount: number
  activeCourseCount: number
  certificateCount: number
  completedEnrollmentCount: number
  totalEnrollmentCount: number
  newUsersThisMonth: number
  newCertificatesThisMonth: number
  pendingModules: number
  pendingUsers: number
  inactiveCourses: number
  eventCount: number
  pathCount: number
  regionalStats: RegionalStat[]
  loading: boolean
  error: string | null
  refresh: () => Promise<void>
}

const AdminStatsContext = createContext<AdminStats | null>(null)

export function useAdminStats() {
  const ctx = useContext(AdminStatsContext)
  if (!ctx) throw new Error("useAdminStats must be used within AdminStatsProvider")
  return ctx
}

/** Optional hook for leaves that may render outside the provider. */
export function useAdminStatsOptional() {
  return useContext(AdminStatsContext)
}

function monthAgoIso() {
  const d = new Date()
  d.setMonth(d.getMonth() - 1)
  return d.toISOString()
}

async function loadAdminStats(): Promise<Omit<AdminStats, "loading" | "error" | "refresh">> {
  const monthAgo = monthAgoIso()
  const now = new Date().toISOString()

  const [
    users,
    courses,
    activeCourses,
    certificates,
    completedEnrollments,
    totalEnrollments,
    newUsers,
    newCertificates,
    pendingModules,
    pendingUsers,
    inactiveCourses,
    events,
    paths,
    regional,
  ] = await Promise.all([
    supabaseBrowser.from("users").select("id", { count: "exact", head: true }),
    supabaseBrowser.from("courses").select("id", { count: "exact", head: true }),
    supabaseBrowser.from("courses").select("id", { count: "exact", head: true }).eq("is_active", true),
    supabaseBrowser.from("certificates").select("id", { count: "exact", head: true }).eq("status", "active"),
    // Count-only — previously downloaded every completed enrollment row.
    supabaseBrowser.from("enrollments").select("id", { count: "exact", head: true }).eq("status", "completed"),
    supabaseBrowser.from("enrollments").select("id", { count: "exact", head: true }),
    supabaseBrowser.from("users").select("id", { count: "exact", head: true }).gte("created_at", monthAgo),
    supabaseBrowser
      .from("certificates")
      .select("id", { count: "exact", head: true })
      .eq("status", "active")
      .gte("issued_at", monthAgo),
    supabaseBrowser.from("modules").select("id", { count: "exact", head: true }).eq("status", "pending_review"),
    supabaseBrowser.from("users").select("id", { count: "exact", head: true }).eq("status", "pending"),
    supabaseBrowser.from("courses").select("id", { count: "exact", head: true }).eq("is_active", false),
    supabaseBrowser
      .from("events")
      .select("id", { count: "exact", head: true })
      .eq("is_published", true)
      .gte("starts_at", now),
    supabaseBrowser.from("learningpaths").select("id", { count: "exact", head: true }).eq("status", "active"),
    // Province only — still one column, but no other user fields.
    supabaseBrowser.from("users").select("province").not("province", "is", null),
  ])

  const firstError =
    users.error ||
    courses.error ||
    activeCourses.error ||
    certificates.error ||
    completedEnrollments.error ||
    totalEnrollments.error ||
    newUsers.error ||
    newCertificates.error ||
    pendingModules.error ||
    pendingUsers.error ||
    inactiveCourses.error ||
    events.error ||
    paths.error ||
    regional.error

  if (firstError) throw new Error(firstError.message)

  const provinceCounts: Record<string, number> = {}
  for (const row of regional.data ?? []) {
    if (row.province) provinceCounts[row.province] = (provinceCounts[row.province] || 0) + 1
  }
  const regionalStats = Object.entries(provinceCounts)
    .map(([province, users]) => ({ province, users }))
    .sort((a, b) => b.users - a.users)
    .slice(0, 5)

  return {
    userCount: users.count ?? 0,
    courseCount: courses.count ?? 0,
    activeCourseCount: activeCourses.count ?? 0,
    certificateCount: certificates.count ?? 0,
    completedEnrollmentCount: completedEnrollments.count ?? 0,
    totalEnrollmentCount: totalEnrollments.count ?? 0,
    newUsersThisMonth: newUsers.count ?? 0,
    newCertificatesThisMonth: newCertificates.count ?? 0,
    pendingModules: pendingModules.count ?? 0,
    pendingUsers: pendingUsers.count ?? 0,
    inactiveCourses: inactiveCourses.count ?? 0,
    eventCount: events.count ?? 0,
    pathCount: paths.count ?? 0,
    regionalStats,
  }
}

export function AdminStatsProvider({ children }: { children: ReactNode }) {
  const [data, setData] = useState<Omit<AdminStats, "loading" | "error" | "refresh"> | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const refresh = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const next = await loadAdminStats()
      setData(next)
    } catch (err: any) {
      setError(err?.message || "Failed to load admin stats")
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    refresh()
  }, [refresh])

  const value: AdminStats = {
    userCount: data?.userCount ?? 0,
    courseCount: data?.courseCount ?? 0,
    activeCourseCount: data?.activeCourseCount ?? 0,
    certificateCount: data?.certificateCount ?? 0,
    completedEnrollmentCount: data?.completedEnrollmentCount ?? 0,
    totalEnrollmentCount: data?.totalEnrollmentCount ?? 0,
    newUsersThisMonth: data?.newUsersThisMonth ?? 0,
    newCertificatesThisMonth: data?.newCertificatesThisMonth ?? 0,
    pendingModules: data?.pendingModules ?? 0,
    pendingUsers: data?.pendingUsers ?? 0,
    inactiveCourses: data?.inactiveCourses ?? 0,
    eventCount: data?.eventCount ?? 0,
    pathCount: data?.pathCount ?? 0,
    regionalStats: data?.regionalStats ?? [],
    loading,
    error,
    refresh,
  }

  return <AdminStatsContext.Provider value={value}>{children}</AdminStatsContext.Provider>
}
