/**
 * Date formatting utilities with a fixed "en-US" locale so output is identical
 * on the Vercel server (UTC, no system locale) and in any user's browser.
 * Never use toLocaleDateString() / toLocaleTimeString() without a locale —
 * the "undefined" locale produces different strings server vs client and causes
 * React hydration mismatches (error #418).
 */

/** "Aug 19, 2026" */
export function formatDate(iso: string | null | undefined): string {
  if (!iso) return "N/A"
  return new Date(iso).toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  })
}

/** "Aug 19, 2026, 2:00 PM" */
export function formatDateTime(iso: string | null | undefined): string {
  if (!iso) return "N/A"
  return new Date(iso).toLocaleString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  })
}

/** "2:00 PM" */
export function formatTime(iso: string | null | undefined): string {
  if (!iso) return "N/A"
  return new Date(iso).toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
  })
}

/** "1,234" — locale-safe number formatting */
export function formatNumber(n: number | null | undefined): string {
  if (n == null) return "0"
  return n.toLocaleString("en-US")
}
