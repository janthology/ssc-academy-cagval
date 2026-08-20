import type { Event } from "@/lib/types/database"
import { formatDate, formatTimeRange } from "@/lib/utils/dates"

// Slugs are stored; labels are display-only (same split as the user_type and
// organization_type label maps used elsewhere in admin/dashboard views).
export const EVENT_TYPE_LABEL: Record<Event["event_type"], string> = {
  live_session: "Live Session",
  hands_on: "Hands-on",
  conference: "Conference",
}

export const EVENT_TYPE_OPTIONS = Object.entries(EVENT_TYPE_LABEL) as [Event["event_type"], string][]

/** "Dec 15, 2025" — uses platform timezone for SSR/client parity. */
export function eventDate(iso: string) {
  return formatDate(iso)
}

/** "2:00 PM", or "2:00 PM – 4:00 PM" when an end time exists. */
export function eventTime(startsAt: string, endsAt?: string | null) {
  return formatTimeRange(startsAt, endsAt)
}
