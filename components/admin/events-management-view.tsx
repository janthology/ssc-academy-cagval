"use client"

import { useCallback, useEffect, useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Calendar, MapPin, Plus, Search, Pencil, Trash2, Loader2 } from "lucide-react"
import { supabaseBrowser } from "@/lib/supabase/browser-client"
import { recordAdminAction } from "@/lib/admin/log-client"
import { EventFormDialog } from "@/components/admin/event-form-dialog"
import { EVENT_TYPE_LABEL, eventDate, eventTime } from "@/lib/events/format"
import type { Event } from "@/lib/types/database"

function revalidateEvents() {
  fetch("/api/revalidate", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ path: "/events" }),
  }).catch(() => {})
}

/**
 * Admin events CRUD. Reads every row (events_public_read admits admins to
 * drafts too), splits upcoming vs past, and delegates create/edit to the
 * shared EventFormDialog. Delete requires a second click to confirm.
 */
export function EventsManagementView() {
  const [events, setEvents] = useState<Event[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState("")
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editing, setEditing] = useState<Event | null>(null)
  const [confirmId, setConfirmId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    const { data, error: loadError } = await supabaseBrowser
      .from("events")
      .select("*")
      .order("starts_at", { ascending: false })
    if (loadError) setError(loadError.message)
    setEvents((data ?? []) as Event[])
    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])

  const remove = async (ev: Event) => {
    setError(null)
    const { error: delError } = await supabaseBrowser.from("events").delete().eq("id", ev.id)
    if (delError) {
      setError(delError.message)
      return
    }
    recordAdminAction("event_deleted", ev.id, { message: `Event deleted: ${ev.title}` })
    revalidateEvents()
    setConfirmId(null)
    load()
  }

  const q = search.trim().toLowerCase()
  const filtered = q
    ? events.filter((e) => e.title.toLowerCase().includes(q) || (e.location ?? "").toLowerCase().includes(q))
    : events
  const now = Date.now()
  const upcoming = filtered
    .filter((e) => new Date(e.starts_at).getTime() >= now)
    .sort((a, b) => +new Date(a.starts_at) - +new Date(b.starts_at))
  const past = filtered.filter((e) => new Date(e.starts_at).getTime() < now)

  const Row = ({ ev }: { ev: Event }) => (
    <div className="flex items-start gap-4 rounded-lg border p-4">
      <div className="flex-1 space-y-1">
        <div className="flex flex-wrap items-center gap-2">
          <h4 className="font-medium">{ev.title}</h4>
          <Badge variant="outline" className="text-xs">{EVENT_TYPE_LABEL[ev.event_type]}</Badge>
          {!ev.is_published && <Badge variant="secondary" className="text-xs">Draft</Badge>}
        </div>
        <p className="text-sm text-muted-foreground">
          {eventDate(ev.starts_at)} at {eventTime(ev.starts_at, ev.ends_at)}
        </p>
        {ev.location && (
          <p className="flex items-center gap-1 text-xs text-muted-foreground">
            <MapPin className="h-3 w-3" />
            {ev.location}
          </p>
        )}
      </div>
      <div className="flex shrink-0 gap-2">
        <Button
          variant="outline"
          size="sm"
          aria-label={`Edit ${ev.title}`}
          onClick={() => { setEditing(ev); setDialogOpen(true) }}
        >
          <Pencil className="h-4 w-4" />
        </Button>
        {confirmId === ev.id ? (
          <>
            <Button variant="destructive" size="sm" onClick={() => remove(ev)}>Confirm</Button>
            <Button variant="ghost" size="sm" onClick={() => setConfirmId(null)}>Cancel</Button>
          </>
        ) : (
          <Button
            variant="outline"
            size="sm"
            aria-label={`Delete ${ev.title}`}
            onClick={() => setConfirmId(ev.id)}
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        )}
      </div>
    </div>
  )

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Events</h1>
          <p className="text-muted-foreground">Platform-wide announcements shown to every user</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="relative">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search events..."
              className="w-64 pl-10"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <Button onClick={() => { setEditing(null); setDialogOpen(true) }} className="gap-2">
            <Plus className="h-4 w-4" /> Create Event
          </Button>
        </div>
      </div>

      {error && <p className="text-sm text-destructive">{error}</p>}

      {loading ? (
        <div className="text-center">
          <Loader2 className="mx-auto h-8 w-8 animate-spin" />
        </div>
      ) : (
        <>
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Calendar className="h-5 w-5" />
                Upcoming
              </CardTitle>
              <CardDescription>{upcoming.length} scheduled</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {upcoming.length === 0 ? (
                <p className="py-6 text-center text-muted-foreground">No upcoming events.</p>
              ) : (
                upcoming.map((ev) => <Row key={ev.id} ev={ev} />)
              )}
            </CardContent>
          </Card>

          {past.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Past</CardTitle>
                <CardDescription>{past.length} finished</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                {past.map((ev) => <Row key={ev.id} ev={ev} />)}
              </CardContent>
            </Card>
          )}
        </>
      )}

      <EventFormDialog event={editing} open={dialogOpen} onOpenChange={setDialogOpen} onSaved={load} />
    </div>
  )
}
