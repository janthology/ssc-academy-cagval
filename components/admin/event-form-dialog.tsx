"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { supabaseBrowser } from "@/lib/supabase/browser-client"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Switch } from "@/components/ui/switch"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { recordAdminAction } from "@/lib/admin/log-client"
import { EVENT_TYPE_OPTIONS } from "@/lib/events/format"
import type { Event } from "@/lib/types/database"

// <input type="datetime-local"> works in local wall-clock "YYYY-MM-DDTHH:mm";
// the column is timestamptz. Convert explicitly in both directions.
const toLocalInput = (iso?: string | null) => {
  if (!iso) return ""
  const d = new Date(iso)
  const pad = (n: number) => String(n).padStart(2, "0")
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}
const toIso = (local: string) => new Date(local).toISOString()

function revalidateEvents() {
  fetch("/api/revalidate", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ path: "/events" }),
  }).catch(() => {})
}

/**
 * Shared create/edit event dialog (controlled). `event` undefined => create
 * (INSERT); present => edit (UPDATE by id). Both go through events_admin_write
 * RLS, and both log to admin_logs. Mirrors CourseFormDialog's conventions:
 * inline useState validation (no form library), supabaseBrowser write,
 * recordAdminAction, then revalidate + router.refresh().
 */
export function EventFormDialog({
  event,
  open,
  onOpenChange,
  onSaved,
}: {
  event?: Event | null
  open: boolean
  onOpenChange: (o: boolean) => void
  onSaved?: () => void
}) {
  const router = useRouter()
  const isEdit = !!event
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [title, setTitle] = useState("")
  const [description, setDescription] = useState("")
  const [eventType, setEventType] = useState<Event["event_type"]>("live_session")
  const [startsAt, setStartsAt] = useState("")
  const [endsAt, setEndsAt] = useState("")
  const [location, setLocation] = useState("")
  const [isPublished, setIsPublished] = useState(true)

  // (Re)initialise whenever the dialog opens — from `event` in edit mode, or
  // defaults in create mode.
  useEffect(() => {
    if (!open) return
    if (event) {
      setTitle(event.title ?? "")
      setDescription(event.description ?? "")
      setEventType(event.event_type ?? "live_session")
      setStartsAt(toLocalInput(event.starts_at))
      setEndsAt(toLocalInput(event.ends_at))
      setLocation(event.location ?? "")
      setIsPublished(event.is_published)
    } else {
      setTitle("")
      setDescription("")
      setEventType("live_session")
      setStartsAt("")
      setEndsAt("")
      setLocation("")
      setIsPublished(true)
    }
    setError(null)
  }, [open, event])

  const handleSubmit = async () => {
    setError(null)

    if (!title.trim()) return setError("Title is required.")
    if (!startsAt) return setError("Start date and time are required.")
    if (endsAt && new Date(endsAt) <= new Date(startsAt)) {
      return setError("End time must be after the start time.")
    }

    const payload = {
      title: title.trim(),
      description: description.trim(),
      event_type: eventType,
      starts_at: toIso(startsAt),
      ends_at: endsAt ? toIso(endsAt) : null,
      location: location.trim() || null,
      is_published: isPublished,
      updated_at: new Date().toISOString(),
    }

    setSaving(true)
    try {
      if (isEdit && event) {
        const { error: updateError } = await supabaseBrowser
          .from("events")
          .update(payload)
          .eq("id", event.id)
        if (updateError) throw new Error(updateError.message)
        recordAdminAction("event_updated", event.id, { message: `Event updated: ${payload.title}` })
      } else {
        const { data: { user } } = await supabaseBrowser.auth.getUser()
        const { error: insertError } = await supabaseBrowser
          .from("events")
          .insert({ ...payload, created_by: user?.id ?? null })
        if (insertError) throw new Error(insertError.message)
        recordAdminAction("event_created", null, {
          data: { title: payload.title, starts_at: payload.starts_at },
        })
      }

      revalidateEvents()
      onSaved?.()
      onOpenChange(false)
      router.refresh()
    } catch (err: any) {
      setError(err.message || "Failed to save event.")
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{isEdit ? "Edit Event" : "Create Event"}</DialogTitle>
          <DialogDescription>
            Events appear on every learner&apos;s dashboard and on the public events page.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="event-title">Title</Label>
            <Input
              id="event-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Smart Cities Webinar"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="event-description">Description</Label>
            <Textarea
              id="event-description"
              rows={3}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="What is this event about?"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="event-type">Type</Label>
            <Select value={eventType} onValueChange={(v) => setEventType(v as Event["event_type"])}>
              <SelectTrigger id="event-type"><SelectValue /></SelectTrigger>
              <SelectContent>
                {EVENT_TYPE_OPTIONS.map(([value, label]) => (
                  <SelectItem key={value} value={value}>{label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="event-starts">Starts</Label>
              <Input
                id="event-starts"
                type="datetime-local"
                value={startsAt}
                onChange={(e) => setStartsAt(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="event-ends">Ends (optional)</Label>
              <Input
                id="event-ends"
                type="datetime-local"
                value={endsAt}
                onChange={(e) => setEndsAt(e.target.value)}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="event-location">Venue or join link (optional)</Label>
            <Input
              id="event-location"
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              placeholder="e.g. DOST Region 2 Auditorium, or https://zoom.us/j/…"
            />
          </div>

          <div className="flex items-center justify-between rounded-lg border p-3">
            <div>
              <Label htmlFor="event-published">Published</Label>
              <p className="text-xs text-muted-foreground">
                Unpublished events are visible to admins only.
              </p>
            </div>
            <Switch id="event-published" checked={isPublished} onCheckedChange={setIsPublished} />
          </div>

          {error && <p className="text-sm text-destructive">{error}</p>}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={saving}>
            {saving ? "Saving…" : isEdit ? "Save Changes" : "Create Event"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
