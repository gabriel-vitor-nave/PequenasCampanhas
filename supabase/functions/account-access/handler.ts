import { normalizeUsername, validNewPassword, validUsername } from '../../../shared/credentials.ts'

export type AccountEnv = { url: string; serviceKey: string; publicKey: string; legacyKey?: string }
type Fetcher = typeof fetch
type JsonObject = Record<string, unknown>
class AccountError extends Error {
  constructor(readonly code: string, readonly status: number) { super(code) }
}
const origins = new Set(['https://pequenas-campanhas.ripplingantelope.chatgpt.site', 'http://127.0.0.1:5173', 'http://localhost:5173', 'http://127.0.0.1:4173'])

async function limitedBody(request: Request): Promise<JsonObject> {
  const reader = request.body?.getReader()
  if (!reader) throw new AccountError('PC_INVALID_INPUT', 400)
  const chunks: Uint8Array[] = []; let size = 0
  try {
    while (true) {
      const { value, done } = await reader.read()
      if (done) break
      size += value.byteLength
      if (size > 4096) { await reader.cancel(); throw new AccountError('PC_INVALID_INPUT', 413) }
      chunks.push(value)
    }
  } finally { reader.releaseLock() }
  const bytes = new Uint8Array(size); let offset = 0
  for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength }
  try {
    const value: unknown = JSON.parse(new TextDecoder().decode(bytes))
    if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error()
    return value as JsonObject
  } catch { throw new AccountError('PC_INVALID_INPUT', 400) }
}

export function createAccountHandler(env: AccountEnv, fetcher: Fetcher = fetch) {
  return async (request: Request): Promise<Response> => {
    const origin = request.headers.get('origin')
    const headers: Record<string, string> = { 'Content-Type': 'application/json', 'Cache-Control': 'no-store', 'Vary': 'Origin', 'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type', 'Access-Control-Allow-Methods': 'POST, OPTIONS' }
    if (origin && origins.has(origin)) headers['Access-Control-Allow-Origin'] = origin
    const respond = (data: unknown, status = 200) => new Response(JSON.stringify(data), { status, headers })
    if (origin && !origins.has(origin)) return respond({ code: 'PC_FORBIDDEN' }, 403)
    if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers })
    if (request.method !== 'POST') return respond({ code: 'PC_INVALID_INPUT' }, 405)
    if (!env.serviceKey || !env.url || !env.publicKey) return respond({ code: 'PC_AUTH_UNAVAILABLE' }, 503)
    const suppliedKey = request.headers.get('apikey')
    if (!suppliedKey || (suppliedKey !== env.publicKey && suppliedKey !== env.legacyKey)) return respond({ code: 'PC_FORBIDDEN' }, 403)

    const admin = async (path: string, init: RequestInit = {}) => fetcher(env.url + path, {
      ...init, headers: { 'Content-Type': 'application/json', apikey: env.serviceKey, Authorization: `Bearer ${env.serviceKey}`, ...init.headers },
    })
    const rate = async (bucket: string, limit: number, seconds: number) => {
      const result = await admin('/rest/v1/rpc/claim_auth_attempt', { method: 'POST', body: JSON.stringify({ p_bucket: bucket, p_limit: limit, p_seconds: seconds }) })
      if (!result.ok) throw new AccountError('PC_AUTH_UNAVAILABLE', 503)
      if (await result.json() !== true) throw new AccountError('PC_TOO_MANY_ATTEMPTS', 429)
    }
    try {
      const input = await limitedBody(request)
      const action = input.action
      const username = typeof input.username === 'string' ? normalizeUsername(input.username) : ''
      const password = typeof input.password === 'string' ? input.password : ''
      if (!['login', 'register'].includes(String(action)) || !validUsername(username) || !password || new TextEncoder().encode(password).length > 72) throw new AccountError('PC_INVALID_INPUT', 400)
      if (action === 'register' && !validNewPassword(password)) throw new AccountError('weak_password', 400)
      await rate('global:access', 300, 600)
      // Header-derived limits are supplementary; a global limit also applies to all callers.
      const source = request.headers.get('x-forwarded-for')?.split(',').at(-1)?.trim() || 'unknown'
      const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(env.serviceKey + ':' + source))
      const ipHash = [...new Uint8Array(digest)].map(byte => byte.toString(16).padStart(2, '0')).join('')
      await rate(`access:${ipHash}`, 40, 600)
      const lookup = await admin(`/rest/v1/profiles?select=id,username&username=eq.${encodeURIComponent(username)}`)
      if (!lookup.ok) throw new AccountError('PC_AUTH_UNAVAILABLE', 503)
      const profiles = await lookup.json() as Array<{ id: string; username: string }>
      let accountId = profiles[0]?.id
      let email: string
      if (action === 'register') {
        await rate('global:register', 30, 3600)
        await rate(`register:${ipHash}`, 10, 3600)
        if (accountId) throw new AccountError('PC_USERNAME_TAKEN', 409)
        email = `${crypto.randomUUID()}@accounts.pequenas-campanhas.invalid`
        const created = await admin('/auth/v1/admin/users', { method: 'POST', body: JSON.stringify({ email, password, email_confirm: true, user_metadata: { display_name: username } }) })
        if (!created.ok) throw new AccountError('PC_AUTH_UNAVAILABLE', 503)
        const user = await created.json() as { id?: string }
        if (!user.id) throw new AccountError('PC_AUTH_UNAVAILABLE', 503)
        accountId = user.id
        const saved = await admin(`/rest/v1/profiles?id=eq.${encodeURIComponent(accountId)}`, { method: 'PATCH', headers: { Prefer: 'return=representation' }, body: JSON.stringify({ username, display_name: username }) })
        if (!saved.ok || (await saved.json() as unknown[]).length !== 1) {
          // Compensate only for the account this request just created; never accept a caller-supplied ID.
          const cleanup = await admin(`/auth/v1/admin/users/${encodeURIComponent(accountId)}`, { method: 'DELETE' })
          if (!cleanup.ok) throw new AccountError('PC_AUTH_UNAVAILABLE', 503)
          throw new AccountError(saved.status === 409 ? 'PC_USERNAME_TAKEN' : 'PC_AUTH_UNAVAILABLE', saved.status === 409 ? 409 : 503)
        }
      } else {
        if (!accountId) throw new AccountError('invalid_credentials', 401)
        const response = await admin(`/auth/v1/admin/users/${encodeURIComponent(accountId)}`)
        if (!response.ok) throw new AccountError('PC_AUTH_UNAVAILABLE', 503)
        const user = await response.json() as { email?: string }
        if (!user.email) throw new AccountError('invalid_credentials', 401)
        email = user.email
      }
      const signIn = () => fetcher(env.url + '/auth/v1/token?grant_type=password', { method: 'POST', headers: { 'Content-Type': 'application/json', apikey: env.publicKey }, body: JSON.stringify({ email, password }) })
      let result = await signIn()
      if (result.status === 429) throw new AccountError('PC_TOO_MANY_ATTEMPTS', 429)
      if (action === 'login' && accountId && !email.endsWith('@accounts.pequenas-campanhas.invalid')) {
        let proven = result.ok
        if (!proven) {
          const failure = await result.clone().json() as { code?: string }
          if (failure.code === 'email_not_confirmed') {
            const checked = await admin('/rest/v1/rpc/verify_legacy_password', { method: 'POST', body: JSON.stringify({ p_user_id: accountId, p_password: password }) })
            proven = checked.ok && await checked.json() === true
          }
        }
        if (proven) {
          email = `${accountId}@accounts.pequenas-campanhas.invalid`
          const converted = await admin(`/auth/v1/admin/users/${encodeURIComponent(accountId)}`, { method: 'PUT', body: JSON.stringify({ email, email_confirm: true }) })
          if (!converted.ok) throw new AccountError('PC_AUTH_UNAVAILABLE', 503)
          result = await signIn()
        }
      }
      if (!result.ok) throw new AccountError('invalid_credentials', 401)
      const session = await result.json() as { access_token?: string; refresh_token?: string }
      if (!session.access_token || !session.refresh_token) throw new AccountError('PC_AUTH_UNAVAILABLE', 503)
      return respond({ session: { access_token: session.access_token, refresh_token: session.refresh_token } })
    } catch (error) {
      return respond({ code: error instanceof AccountError ? error.code : 'PC_AUTH_UNAVAILABLE' }, error instanceof AccountError ? error.status : 503)
    }
  }
}
