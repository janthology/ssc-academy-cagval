import { supabaseBrowser } from '@/lib/supabase/browser-client'
import type { User } from '@/lib/types/database'

export async function getUserByEmail(email: string): Promise<User | null> {
  try {
    // Only the columns the two callers use: login-form reads user_type; profile
    // settings reads id/name/email/avatar + the org/location form fields.
    const { data, error } = await supabaseBrowser
      .from('users')
      .select('id, name, email, avatar, user_type, organization, position, province, city')
      .eq('email', email)
      .maybeSingle<User>()

    if (error) {
      console.error('Error fetching user by email:', error.message, error.details, error.hint)
      return null
    }

    return data
  } catch (err) {
    console.error('Unexpected error in getUserByEmail:', err)
    return null
  }
}