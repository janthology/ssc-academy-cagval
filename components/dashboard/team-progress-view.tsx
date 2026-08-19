"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import { Building2, Users, CheckCircle, TrendingUp, Loader2 } from "lucide-react"
import { supabaseBrowser } from "@/lib/supabase/browser-client"

type Member = {
  member_id: string
  member_name: string
  member_position: string | null
  enrollments_count: number
  completed_count: number
  progress_sum: number
}

const TYPE_LABEL: Record<string, string> = {
  lgu: "LGU", suc: "SUC", hei: "HEI", government: "Government",
}

/**
 * Real team progress for the caller's organization. Members and metrics come
 * from get_my_team_progress() (SECURITY DEFINER, scoped to the caller's own
 * organization_id) — every number is derived from actual enrollment rows, with
 * no placeholder values. An empty denominator renders as "—", never as 0%.
 */
export function TeamProgressView() {
  const [members, setMembers] = useState<Member[]>([])
  const [org, setOrg] = useState<{ name: string; type: string } | null>(null)
  const [meId, setMeId] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const load = async () => {
      setIsLoading(true)
      try {
        const { data: { user } } = await supabaseBrowser.auth.getUser()
        if (!user) throw new Error("Please log in to view your team.")
        setMeId(user.id)

        const { data: me } = await supabaseBrowser
          .from("users")
          .select("organization_id")
          .eq("id", user.id)
          .single()

        if (me?.organization_id) {
          const { data: orgRow } = await supabaseBrowser
            .from("organizations")
            .select("name, type")
            .eq("id", me.organization_id)
            .single()
          setOrg(orgRow ?? null)

          const { data, error: rpcError } = await supabaseBrowser.rpc("get_my_team_progress")
          if (rpcError) throw new Error(rpcError.message)
          setMembers((data ?? []) as Member[])
        }
      } catch (err: any) {
        setError(err.message || "Failed to load team data.")
      } finally {
        setIsLoading(false)
      }
    }
    load()
  }, [])

  if (isLoading) {
    return (
      <div className="text-center">
        <Loader2 className="mx-auto h-8 w-8 animate-spin" />
        <p className="mt-2 text-muted-foreground">Loading...</p>
      </div>
    )
  }

  if (error) return <p className="text-red-600">{error}</p>

  // Not linked to an organization — the state a user is in until they pick one
  // in Profile Settings (or registration).
  if (!org) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            Team Progress
          </CardTitle>
          <CardDescription>You&apos;re not linked to an organization yet.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Set your organization in Profile Settings to see how your team is progressing.
            If your organization isn&apos;t listed yet, an administrator can add it.
          </p>
          <Button asChild>
            <Link href="/dashboard/profile">Go to Profile Settings</Link>
          </Button>
        </CardContent>
      </Card>
    )
  }

  const totalEnrollments = members.reduce((s, m) => s + m.enrollments_count, 0)
  const totalCompleted = members.reduce((s, m) => s + m.completed_count, 0)
  const totalProgress = members.reduce((s, m) => s + m.progress_sum, 0)

  // Headline metric. null (not zero) when nobody has enrolled yet — an empty
  // denominator must not be reported as 0%.
  const completionRate = totalEnrollments > 0
    ? Math.round((totalCompleted / totalEnrollments) * 100)
    : null
  const averageProgress = totalEnrollments > 0
    ? Math.round(totalProgress / totalEnrollments)
    : null

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-serif text-3xl font-bold text-foreground">Team Progress</h1>
          <p className="text-muted-foreground">
            {members.length} {members.length === 1 ? "member" : "members"} in your organization
          </p>
        </div>
        <Badge variant="secondary" className="gap-2">
          <Building2 className="h-4 w-4" />
          {org.name}
          {TYPE_LABEL[org.type] ? ` · ${TYPE_LABEL[org.type]}` : ""}
        </Badge>
      </div>

      {/* Headline: completion rate. Average progress alongside, secondary. */}
      <div className="grid gap-6 md:grid-cols-3">
        <Card className="md:col-span-2">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Completion Rate</CardTitle>
            <CheckCircle className="h-4 w-4 text-green-600" />
          </CardHeader>
          <CardContent>
            <div className="text-4xl font-bold">
              {completionRate === null ? "—" : `${completionRate}%`}
            </div>
            <p className="mt-1 text-xs text-muted-foreground">
              {totalEnrollments === 0
                ? "No course enrolments in this organization yet"
                : `${totalCompleted} of ${totalEnrollments} course enrolments completed`}
            </p>
            {completionRate !== null && <Progress value={completionRate} className="mt-3 h-3" />}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Average Progress</CardTitle>
            <TrendingUp className="h-4 w-4 text-purple-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {averageProgress === null ? "—" : `${averageProgress}%`}
            </div>
            <p className="text-xs text-muted-foreground">Across all enrolments</p>
            {averageProgress !== null && <Progress value={averageProgress} className="mt-3 h-2" />}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            Members
          </CardTitle>
          <CardDescription>Progress for everyone linked to {org.name}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {members.length <= 1 && (
            <p className="py-6 text-center text-muted-foreground">
              No teammates have joined {org.name} yet.
            </p>
          )}

          {members.map((m) => {
            const avg = m.enrollments_count > 0
              ? Math.round(m.progress_sum / m.enrollments_count)
              : null
            return (
              <div key={m.member_id} className="flex items-center gap-4 rounded-lg border p-4">
                <div className="flex-1 space-y-2">
                  <div className="flex items-center gap-2">
                    <h4 className="font-medium">{m.member_name}</h4>
                    {m.member_id === meId && <Badge variant="outline" className="text-xs">You</Badge>}
                  </div>
                  <div className="flex items-center gap-4 text-sm text-muted-foreground">
                    {m.member_position && <span>{m.member_position}</span>}
                    <span>{m.enrollments_count} enrolled</span>
                    <span>{m.completed_count} completed</span>
                  </div>
                  {avg === null ? (
                    <p className="text-xs text-muted-foreground">No enrolments yet</p>
                  ) : (
                    <div className="flex items-center gap-2">
                      <Progress value={avg} className="h-2 flex-1" />
                      <span className="text-sm font-medium">{avg}%</span>
                    </div>
                  )}
                </div>
              </div>
            )
          })}
        </CardContent>
      </Card>
    </div>
  )
}
