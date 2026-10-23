import { createClient } from '@supabase/supabase-js'
import type { SupabaseClient } from '@supabase/supabase-js'

let cachedClient: SupabaseClient | null | undefined

/** Returns null until the public project URL and publishable key are configured. */
export function getSupabaseBrowserClient(): SupabaseClient | null {
  if (cachedClient !== undefined) return cachedClient
  const url = import.meta.env.VITE_SUPABASE_URL?.trim()
  const key = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY?.trim()
  if (!url || !key) {
    cachedClient = null
    return null
  }
  try {
    cachedClient = createClient(url, key, {
      auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true },
    })
  } catch {
    cachedClient = null
  }
  return cachedClient
}

export function isSupabaseBrowserConfigured(): boolean {
  return getSupabaseBrowserClient() !== null
}
