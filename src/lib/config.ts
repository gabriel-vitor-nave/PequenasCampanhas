export function readConfig(env: Record<string, string | undefined>) {
  const url = env.VITE_SUPABASE_URL?.trim()
  const key = env.VITE_SUPABASE_PUBLISHABLE_KEY?.trim()
  if (!url || !key || url.includes('YOUR_PROJECT') || key.includes('YOUR_PUBLIC')) return null
  try {
    const parsed = new URL(url)
    const local = ['localhost', '127.0.0.1'].includes(parsed.hostname)
    if (parsed.protocol !== 'https:' && !(local && parsed.protocol === 'http:')) return null
    // Reject modern secret keys and legacy service-role JWTs before creating a browser client.
    if (key.startsWith('sb_secret_')) return null
    if (key.split('.').length === 3) {
      const payload = JSON.parse(atob(key.split('.')[1].replace(/-/g, '+').replace(/_/g, '/'))) as { role?: string }
      if (payload.role !== 'anon') return null
    } else if (!key.startsWith('sb_publishable_')) return null
    return { url, key }
  } catch { return null }
}
