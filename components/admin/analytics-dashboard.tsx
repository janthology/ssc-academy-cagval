"use client"

import { useEffect, useMemo, useState } from "react"
import { supabaseBrowser } from "@/lib/supabase/browser-client"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import { Users, BookOpen, Award, MapPin, Loader2, GraduationCap, TrendingUp, Star } from "lucide-react"

type UserRow = { id: string; user_type: string; province: string | null; region: string | null }
type CourseRow = { id: string; title: string; enrollment_count: number | null; rating: number | null; is_active: boolean }
type EnrollmentRow = { user_id: string; course_id: string; status: string }

const TYPE_LABEL: Record<string, string> = {
  individual: "Individual", lgu: "LGU", suc: "SUC", hei: "HEI", dost: "DOST", government: "Government",
}
const pct = (part: number, whole: number) => (whole > 0 ? Math.round((part / whole) * 100) : 0)

export function AnalyticsDashboard() {
  const [users, setUsers] = useState<UserRow[]>([])
  const [courses, setCourses] = useState<CourseRow[]>([])
  const [enrollments, setEnrollments] = useState<EnrollmentRow[]>([])
  const [certCount, setCertCount] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const load = async () => {
      setLoading(true)
      setError(null)
      try {
        const [u, c, e, certs] = await Promise.all([
          supabaseBrowser.from("users").select("id, user_type, province, region"),
          supabaseBrowser.from("courses").select("id, title, enrollment_count, rating, is_active"),
          supabaseBrowser.from("enrollments").select("user_id, course_id, status"),
          supabaseBrowser.from("certificates").select("id"),
        ])
        if (u.error) throw new Error(u.error.message)
        if (c.error) throw new Error(c.error.message)
        if (e.error) throw new Error(e.error.message)
        setUsers(u.data ?? [])
        setCourses(c.data ?? [])
        setEnrollments(e.data ?? [])
        setCertCount((certs.data ?? []).length)
      } catch (err: any) {
        setError(err.message || "Failed to load analytics.")
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [])

  const metrics = useMemo(() => {
    const totalEnroll = enrollments.length
    const completed = enrollments.filter((e) => e.status === "completed").length
    const rated = courses.filter((c) => c.rating !== null && c.rating > 0)
    const avgRating = rated.length > 0
      ? (rated.reduce((s, c) => s + (c.rating || 0), 0) / rated.length).toFixed(1)
      : "N/A"
    return {
      totalUsers: users.length,
      activeCourses: courses.filter((c) => c.is_active).length,
      totalEnroll,
      completionRate: pct(completed, totalEnroll),
      certificates: certCount,
      avgRating,
    }
  }, [users, courses, enrollments, certCount])

  const userDistribution = useMemo(() => {
    const total = users.length || 1
    const byType: Record<string, number> = {}
    for (const u of users) byType[u.user_type] = (byType[u.user_type] || 0) + 1
    return Object.keys(TYPE_LABEL)
      .map((t) => ({ type: TYPE_LABEL[t], count: byType[t] || 0, percentage: pct(byType[t] || 0, total) }))
      .filter((r) => r.count > 0)
      .sort((a, b) => b.count - a.count)
  }, [users])

  const coursePerformance = useMemo(() => {
    const totalByCourse: Record<string, number> = {}
    const doneByCourse: Record<string, number> = {}
    for (const e of enrollments) {
      totalByCourse[e.course_id] = (totalByCourse[e.course_id] || 0) + 1
      if (e.status === "completed") doneByCourse[e.course_id] = (doneByCourse[e.course_id] || 0) + 1
    }
    return courses
      .map((c) => {
        const enrolled = totalByCourse[c.id] ?? (c.enrollment_count || 0)
        const done = doneByCourse[c.id] ?? 0
        return { id: c.id, title: c.title, enrolled, completion: pct(done, enrolled), rating: c.rating }
      })
      .sort((a, b) => b.enrolled - a.enrolled)
      .slice(0, 8)
  }, [courses, enrollments])

  const regional = useMemo(() => {
    const provinceOf: Record<string, string> = {}
    for (const u of users) provinceOf[u.id] = (u.province || u.region || "Unspecified").trim() || "Unspecified"
    const usersByProv: Record<string, number> = {}
    for (const u of users) {
      const p = provinceOf[u.id]
      usersByProv[p] = (usersByProv[p] || 0) + 1
    }
    const totalByProv: Record<string, number> = {}
    const doneByProv: Record<string, number> = {}
    for (const e of enrollments) {
      const p = provinceOf[e.user_id]
      if (!p) continue
      totalByProv[p] = (totalByProv[p] || 0) + 1
      if (e.status === "completed") doneByProv[p] = (doneByProv[p] || 0) + 1
    }
    return Object.keys(usersByProv)
      .map((p) => ({ province: p, users: usersByProv[p], completion: pct(doneByProv[p] || 0, totalByProv[p] || 0) }))
      .sort((a, b) => b.users - a.users)
  }, [users, enrollments])

  const metricCards = [
    { title: "Total Users", value: metrics.totalUsers, icon: Users, desc: "Registered platform users" },
    { title: "Active Courses", value: metrics.activeCourses, icon: BookOpen, desc: "Courses open to learners" },
    { title: "Total Enrollments", value: metrics.totalEnroll.toLocaleString(), icon: GraduationCap, desc: "All-time enrollments" },
    { title: "Completion Rate", value: `${metrics.completionRate}%`, icon: TrendingUp, desc: "Completed of all enrollments" },
    { title: "Certificates Issued", value: metrics.certificates.toLocaleString(), icon: Award, desc: "All-time certificates" },
    { title: "Avg Course Rating", value: metrics.avgRating === "N/A" ? "N/A" : `${metrics.avgRating}/5`, icon: Star, desc: "Across rated courses" },
  ]

  if (loading) {
    return (
      <div className="space-y-6">
        <h1 className="text-3xl font-bold text-foreground font-serif">Analytics Dashboard</h1>
        <div className="flex justify-center p-16"><Loader2 className="w-8 h-8 animate-spin" /></div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-foreground font-serif">Analytics Dashboard</h1>
        <p className="text-muted-foreground">Platform performance and user insights (all-time)</p>
      </div>

      {error && <p className="text-sm text-destructive">{error}</p>}

      {/* Key metrics — real aggregates, no fabricated deltas */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {metricCards.map((m) => (
          <Card key={m.title}>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">{m.title}</CardTitle>
              <m.icon className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{m.value}</div>
              <p className="text-xs text-muted-foreground">{m.desc}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid lg:grid-cols-2 gap-6">
        {/* Regional distribution — real per-province user counts + completion */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><MapPin className="w-5 h-5" />Regional Distribution</CardTitle>
            <CardDescription>Users and completion by province</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {regional.length === 0 && <p className="text-sm text-muted-foreground">No user data.</p>}
            {regional.map((r) => (
              <div key={r.province} className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="font-medium">{r.province}</span>
                  <span className="text-sm text-muted-foreground">{r.users} {r.users === 1 ? "user" : "users"}</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-muted-foreground w-20">Completion:</span>
                  <Progress value={r.completion} className="flex-1 h-2" />
                  <span className="text-xs font-medium w-8">{r.completion}%</span>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>

        {/* User distribution — real, by type */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><Users className="w-5 h-5" />User Distribution</CardTitle>
            <CardDescription>Platform users by organization type</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {userDistribution.length === 0 && <p className="text-sm text-muted-foreground">No users.</p>}
            {userDistribution.map((d) => (
              <div key={d.type} className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-3 h-3 bg-primary rounded-full" />
                  <span className="font-medium">{d.type}</span>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-sm text-muted-foreground">{d.count} {d.count === 1 ? "user" : "users"}</span>
                  <Badge variant="outline">{d.percentage}%</Badge>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>

      {/* Course performance — real per-course enrolled / completion / rating */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><BookOpen className="w-5 h-5" />Course Performance</CardTitle>
          <CardDescription>Enrollment and completion by course (top {coursePerformance.length})</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {coursePerformance.length === 0 && <p className="text-sm text-muted-foreground">No courses.</p>}
            {coursePerformance.map((c) => (
              <div key={c.id} className="space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <span className="font-medium truncate">{c.title}</span>
                  <div className="flex items-center gap-4 text-sm shrink-0">
                    <span>{c.enrolled.toLocaleString()} enrolled</span>
                    {c.rating !== null && c.rating > 0 && (
                      <div className="flex items-center gap-1">
                        <Star className="w-3 h-3 fill-yellow-400 text-yellow-400" />
                        <span>{c.rating}</span>
                      </div>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-muted-foreground w-20">Completion:</span>
                  <Progress value={c.completion} className="flex-1 h-2" />
                  <span className="text-xs font-medium w-8">{c.completion}%</span>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
