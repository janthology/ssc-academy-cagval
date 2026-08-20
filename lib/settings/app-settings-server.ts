export const PLACEHOLDER_LEARNING_PATHS_KEY = "show_placeholder_learning_paths"

/** Server/ISR-safe setting read via cached Rest fetch (no supabase-js). */
export async function getBoolSettingCached(key: string, fallback: boolean): Promise<boolean> {
  try {
    const base = process.env.NEXT_PUBLIC_SUPABASE_URL!
    const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    const res = await fetch(
      `${base}/rest/v1/app_settings?key=eq.${encodeURIComponent(key)}&select=bool_value`,
      {
        headers: { apikey: anon, Authorization: `Bearer ${anon}` },
        next: { revalidate: 300 },
      }
    )
    if (!res.ok) return fallback
    const rows = (await res.json()) as { bool_value: boolean }[]
    if (!rows[0]) return fallback
    return rows[0].bool_value
  } catch {
    return fallback
  }
}
