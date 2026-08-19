import type { Event } from "@/lib/types/database"

// Slugs are stored; labels are display-only (same split as the user_type and
// organization_type label maps used elsewhere in admin/dashboard views).
export const EVENT_TYPE_LABEL: Record<Event["event_type"], string> = {
  live_session: "Live Session",
  hands_on: "Hands-on",
  conference: "Conference",
}

export const EVENT_TYPE_OPTIONS = Object.entries(EVENT_TYPE_LABEL) as [Event["event_type"], string][]

/** "Dec 15, 2025" */
export function eventDate(iso: string) {
  return new Date(iso).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })
}

/** "2:00 PM", or "2:00 PM – 4:00 PM" when an end time exists. */
export function eventTime(startsAt: string, endsAt?: string | null) {
  const f = (s: string) => new Date(s).toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" })
  return endsAt ? `${f(startsAt)} – ${f(endsAt)}` : f(startsAt)
}
