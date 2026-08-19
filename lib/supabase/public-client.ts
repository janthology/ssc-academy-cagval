import { createClient } from '@supabase/supabase-js'

// Cookieless anon client for PUBLIC, cacheable server rendering.
//
// It reads NO cookies and holds NO session, which is exactly why the pages that
// use it (catalog, course-detail shell) stay static/ISR: touching cookies() would
// mark the route dynamic and defeat `revalidate`. Anything per-user must NOT go
// through this client — it belongs in a client island with the real session.
export const supabasePublic = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  { auth: { persistSession: false, autoRefreshToken: false } }
)
