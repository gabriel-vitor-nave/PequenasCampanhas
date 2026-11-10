import { createAccountHandler } from './handler.ts'
import { deployedBackend } from '../../../src/lib/deployment.ts'

Deno.serve(createAccountHandler({
  url: Deno.env.get('SUPABASE_URL') ?? '',
  serviceKey: Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
  legacyKey: Deno.env.get('SUPABASE_ANON_KEY'),
  publicKey: Deno.env.get('SUPABASE_PUBLISHABLE_KEY') ?? deployedBackend.VITE_SUPABASE_PUBLISHABLE_KEY,
}))
