import { createClient } from '@supabase/supabase-js'

/**
 * Supabase client with service role key. Bypasses RLS.
 * Use ONLY in server-side admin paths (e.g. cron API route). Never expose to client or use in normal request handlers.
 */
export function createAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !serviceRoleKey) {
    throw new Error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY')
  }
  return createClient(url, serviceRoleKey)
}
