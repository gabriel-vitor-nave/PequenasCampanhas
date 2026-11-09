import { createClient } from '@supabase/supabase-js'
import type { Database } from '../types/database'
import { readConfig } from './config'

export const config = readConfig(import.meta.env)
export const supabase = config ? createClient<Database>(config.url, config.key, {
  auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true, flowType: 'pkce' },
}) : null

export function backend() {
  if (!supabase) throw new Error('PC_NOT_CONFIGURED')
  return supabase
}
