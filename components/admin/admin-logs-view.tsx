"use client"

import { useEffect, useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Activity, Loader2 } from "lucide-react"

type Entry = { type: string; message: string; time: string }

export function AdminLogsView() {
  const [entries, setEntries] = useState<Entry[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const load = async () => {
      try {
        const res = await fetch("/api/admin/logs?limit=100")
        if (!res.ok) throw new Error(`HTTP ${res.status}`)
        const { activity } = (await res.json()) as { activity: Entry[] }
        setEntries(activity ?? [])
      } catch (err: any) {
        setError("Failed to load activity log.")
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [])

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-foreground font-serif">Activity Log</h1>
        <p className="text-muted-foreground">All recorded admin actions, most recent first.</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><Activity className="w-5 h-5" />Admin Activity</CardTitle>
          <CardDescription>Every logged administrative action.</CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex justify-center p-8"><Loader2 className="w-6 h-6 animate-spin" /></div>
          ) : error ? (
            <p className="text-sm text-destructive">{error}</p>
          ) : entries.length === 0 ? (
            <p className="text-sm text-muted-foreground">No admin activity recorded yet.</p>
          ) : (
            <div className="space-y-2">
              {entries.map((e, i) => (
                <div key={i} className="flex items-start justify-between gap-4 p-3 border rounded-lg">
                  <p className="text-sm">{e.message}</p>
                  <p className="text-xs text-muted-foreground whitespace-nowrap">{e.time}</p>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
