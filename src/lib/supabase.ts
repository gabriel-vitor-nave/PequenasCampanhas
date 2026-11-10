import { createClient } from '@supabase/supabase-js'
import type { Database } from '../types/database'
import { readConfig } from './config'
import { deployedBackend } from './deployment'

export const config = readConfig({
  VITE_SUPABASE_URL: import.meta.env.VITE_SUPABASE_URL ?? deployedBackend.VITE_SUPABASE_URL,
  VITE_SUPABASE_PUBLISHABLE_KEY: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY ?? deployedBackend.VITE_SUPABASE_PUBLISHABLE_KEY,
})
export const supabase = config ? createClient<Database>(config.url, config.key, {
  auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true, flowType: 'pkce' },
}) : null

export function backend() {
  if (!supabase) throw new Error('PC_NOT_CONFIGURED')
  return supabase
}
