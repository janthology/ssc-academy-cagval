/**
 * Date formatting utilities with a fixed "en-US" locale AND timezone so output
 * is identical on the Vercel server (UTC runtime) and in any user's browser.
 *
 * Pinning only the locale is not enough — without an explicit timeZone, both
 * toLocaleDateString and getMonth()/getDate() use the runtime's local zone,
 * so a timestamp near midnight can render as different calendar dates/times
 * server vs client and cause React hydration mismatches (error #418).
 */

/** Platform display timezone — DOST Region 02 (Philippines). */
export const DISPLAY_TIMEZONE = "Asia/Manila"

const DATE_OPTS: Intl.DateTimeFormatOptions = {
  timeZone: DISPLAY_TIMEZONE,
  year: "numeric",
  month: "short",
  day: "numeric",
}

const DATETIME_OPTS: Intl.DateTimeFormatOptions = {
  timeZone: DISPLAY_TIMEZONE,
  year: "numeric",
  month: "short",
  day: "numeric",
  hour: "numeric",
  minute: "2-digit",
}

const TIME_OPTS: Intl.DateTimeFormatOptions = {
  timeZone: DISPLAY_TIMEZONE,
  hour: "numeric",
  minute: "2-digit",
}

const NUMERIC_DATE_OPTS: Intl.DateTimeFormatOptions = {
  timeZone: DISPLAY_TIMEZONE,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
}

/** "Aug 19, 2026" */
export function formatDate(iso: string | null | undefined): string {
  if (!iso) return "N/A"
  return new Date(iso).toLocaleDateString("en-US", DATE_OPTS)
}

/** "08/19/2026" */
export function formatDateNumeric(iso: string | null | undefined): string {
  if (!iso) return "N/A"
  return new Date(iso).toLocaleDateString("en-US", NUMERIC_DATE_OPTS)
}

/** "Aug 19, 2026, 2:00 PM" */
export function formatDateTime(iso: string | null | undefined): string {
  if (!iso) return "N/A"
  return new Date(iso).toLocaleString("en-US", DATETIME_OPTS)
}

/** "2:00 PM", or "2:00 PM – 4:00 PM" when an end time exists. */
export function formatTimeRange(
  startsAt: string,
  endsAt?: string | null
): string {
  const start = new Date(startsAt).toLocaleTimeString("en-US", TIME_OPTS)
  if (!endsAt) return start
  const end = new Date(endsAt).toLocaleTimeString("en-US", TIME_OPTS)
  return `${start} – ${end}`
}

/** "2:00 PM" */
export function formatTime(iso: string | null | undefined): string {
  if (!iso) return "N/A"
  return new Date(iso).toLocaleTimeString("en-US", TIME_OPTS)
}

/** Calendar month index (0–11) in the platform timezone. */
export function getDisplayMonth(iso: string): number {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: DISPLAY_TIMEZONE,
    month: "numeric",
  }).formatToParts(new Date(iso))
  return Number(parts.find((p) => p.type === "month")?.value ?? 1) - 1
}

/** "1,234" — locale-safe number formatting */
export function formatNumber(n: number | null | undefined): string {
  if (n == null) return "0"
  return n.toLocaleString("en-US")
}
