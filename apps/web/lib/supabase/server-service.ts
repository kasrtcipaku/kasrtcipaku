import { createClient } from '@supabase/supabase-js'

/**
 * Supabase client dengan service role key.
 * Gunakan HANYA di API routes (server-side) — bypass RLS sepenuhnya.
 * Jangan pernah expose ke client/browser.
 */
export function createServiceClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  )
}
