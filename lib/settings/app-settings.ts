import { supabaseBrowser } from "@/lib/supabase/browser-client"

export { PLACEHOLDER_LEARNING_PATHS_KEY } from "@/lib/settings/app-settings-server"

/**
 * Read a boolean platform setting (public.app_settings, anon-readable).
 *
 * Falls back to `fallback` on any failure — a transient network blip must never
 * silently change what users see.
 */
export async function getBoolSetting(key: string, fallback: boolean): Promise<boolean> {
  try {
    const { data, error } = await supabaseBrowser
      .from("app_settings")
      .select("bool_value")
      .eq("key", key)
      .maybeSingle()
    if (error || !data) return fallback
    return data.bool_value
  } catch {
    return fallback
  }
}
