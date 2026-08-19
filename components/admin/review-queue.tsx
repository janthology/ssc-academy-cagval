"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { supabaseBrowser } from "@/lib/supabase/browser-client"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { ClipboardCheck, Clock } from "lucide-react"

type Row = {
  id: string
  title: string
  submitted_at: string | null
  courseTitle: string
  instructorName: string
}

export function ReviewQueue() {
  const [rows, setRows] = useState<Row[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const load = async () => {
      try {
        // Admin sees all modules via modules_public_read (is_admin branch).
        const { data: mods, error: modError } = await supabaseBrowser
          .from("modules")
          .select("id, title, submitted_at, course_id, submitted_by")
          .eq("status", "pending_review")
          .order("submitted_at", { ascending: true })
        if (modError) throw new Error(modError.message)

        const courseIds = [...new Set((mods ?? []).map((m: any) => m.course_id).filter(Boolean))]
        const userIds = [...new Set((mods ?? []).map((m: any) => m.submitted_by).filter(Boolean))]

        const [{ data: courses }, { data: users }] = await Promise.all([
          courseIds.length
            ? supabaseBrowser.from("courses").select("id, title").in("id", courseIds)
            : Promise.resolve({ data: [] as any[] }),
          userIds.length
            ? supabaseBrowser.from("users").select("id, name").in("id", userIds)
            : Promise.resolve({ data: [] as any[] }),
        ])
        const courseTitle = Object.fromEntries((courses ?? []).map((c: any) => [c.id, c.title]))
        const userName = Object.fromEntries((users ?? []).map((u: any) => [u.id, u.name]))

        setRows((mods ?? []).map((m: any) => ({
          id: m.id,
          title: m.title,
          submitted_at: m.submitted_at,
          courseTitle: m.course_id ? (courseTitle[m.course_id] ?? "Unknown course") : "Not yet assigned",
          instructorName: userName[m.submitted_by] ?? "—",
        })))
      } catch (err: any) {
        setError(err.message || "Failed to load review queue.")
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [])

  if (loading) return <div className="text-center p-6">Loading...</div>
  if (error) return <div className="text-center p-6 text-red-600">{error}</div>

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-foreground font-serif">Content Review</h1>
        <p className="text-muted-foreground">Modules submitted by instructors, awaiting review</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ClipboardCheck className="w-5 h-5" />
            Pending Review
            <Badge variant="secondary" className="ml-2">{rows.length}</Badge>
          </CardTitle>
          <CardDescription>Oldest submissions first</CardDescription>
        </CardHeader>
        <CardContent>
          {rows.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nothing awaiting review.</p>
          ) : (
            <div className="space-y-3">
              {rows.map((r) => (
                <div key={r.id} className="flex items-center gap-4 p-4 border rounded-lg">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <h4 className="font-semibold truncate">{r.title}</h4>
                      <Badge variant="outline">{r.courseTitle}</Badge>
                    </div>
                    <div className="flex items-center gap-4 text-sm text-muted-foreground mt-1">
                      <span>by {r.instructorName}</span>
                      <span className="flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        {r.submitted_at ? new Date(r.submitted_at).toLocaleString() : "—"}
                      </span>
                    </div>
                  </div>
                  <Button asChild size="sm">
                    <Link href={`/admin/review/${r.id}`}>Review</Link>
                  </Button>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
