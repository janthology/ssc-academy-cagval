import { supabaseBrowser } from '@/lib/supabase/browser-client'
import type { User } from '@/lib/types/database'

export async function getUserByEmail(email: string): Promise<User | null> {
  try {
    // Login needs status for the pending/inactive gate; profile settings uses the rest.
    const { data, error } = await supabaseBrowser
      .from('users')
      .select('id, name, email, avatar, user_type, organization, position, province, city, status')
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