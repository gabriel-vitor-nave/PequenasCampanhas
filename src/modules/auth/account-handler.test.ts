// @vitest-environment node
import { describe, expect, it, vi } from 'vitest'
import { createAccountHandler } from '../../../supabase/functions/account-access/handler'
import { normalizeUsername, validNewPassword, validUsername } from '../../../shared/credentials'

const env = { url: 'https://backend.test', serviceKey: 'test-server-only-key', publicKey: 'test-public-key' }
const id = '40000000-0000-4000-8000-000000000001'
const json = (value: unknown, status = 200) => new Response(JSON.stringify(value), { status, headers: { 'Content-Type': 'application/json' } })
function fixture(options: { exists?: boolean; rateAllowed?: boolean; passwordAccepted?: boolean; legacy?: boolean; legacyProof?: boolean } = {}) {
  let converted = false
  const fetcher = vi.fn<typeof fetch>(async (input, init) => {
    const url = String(input)
    if (url.includes('claim_auth_attempt')) return json(options.rateAllowed !== false)
    if (url.includes('verify_legacy_password')) return json(options.legacyProof === true)
    if (url.includes('/profiles?') && init?.method === 'PATCH') return json([{ id, username: 'jogador' }])
    if (url.includes('/profiles?')) return json(options.exists ? [{ id, username: 'jogador' }] : [])
    if (url.endsWith('/admin/users') && init?.method === 'POST') return json({ id })
    if (url.includes('/admin/users/') && init?.method === 'PUT') { converted = true; return json({ id }) }
    if (url.includes('/admin/users/')) return json({ id, email: options.legacy ? 'old-account@example.invalid' : id + '@accounts.pequenas-campanhas.invalid' })
    if (url.includes('/token?')) {
      if (options.legacy && !converted) return json({ code: 'email_not_confirmed' }, 400)
      return options.passwordAccepted === false ? json({ error: 'invalid_grant' }, 400) : json({ access_token: 'test-access', refresh_token: 'test-refresh' })
    }
    throw new Error('Unexpected request: ' + url)
  })
  return { fetcher, handler: createAccountHandler(env, fetcher) }
}
function request(body: unknown, key = env.publicKey) {
  return new Request(env.url, { method: 'POST', headers: { apikey: key, 'Content-Type': 'application/json', origin: 'https://pequenas-campanhas.ripplingantelope.chatgpt.site' }, body: JSON.stringify(body) })
}
describe('username identity validation', () => {
  it('normalizes case and rejects contact emails or unsafe usernames', () => {
    expect(normalizeUsername(' Kbum ')).toBe('kbum')
    for (const value of ['x', 'a@b.com', '../name', 'user name', 'a'.repeat(33)]) expect(validUsername(value)).toBe(false)
    expect(validUsername('meu_usuario-1')).toBe(true)
    expect(validNewPassword('short')).toBe(false)
    expect(validNewPassword('é'.repeat(40))).toBe(false)
  })
})
describe('server-side username access', () => {
  it('registers without any contact email and returns only session tokens', async () => {
    const { handler, fetcher } = fixture()
    const response = await handler(request({ action: 'register', username: 'Jogador', password: 'my-password-123' }))
    expect(response.status).toBe(200)
    const body = await response.json()
    expect(body).toEqual({ session: { access_token: 'test-access', refresh_token: 'test-refresh' } })
    const creation = fetcher.mock.calls.find(([url, init]) => String(url).endsWith('/admin/users') && init?.method === 'POST')
    const payload = JSON.parse(String(creation?.[1]?.body))
    expect(payload.email).toMatch(/@accounts\.pequenas-campanhas\.invalid$/)
    expect(payload.email_confirm).toBe(true)
    expect(JSON.stringify(body)).not.toContain(env.serviceKey)
    expect(response.headers.get('cache-control')).toBe('no-store')
  })
  it('signs in through native password validation', async () => {
    const { handler, fetcher } = fixture({ exists: true })
    expect((await handler(request({ action: 'login', username: 'jogador', password: 'my-password' }))).status).toBe(200)
    expect(fetcher.mock.calls.some(([url]) => String(url).includes('/auth/v1/token?grant_type=password'))).toBe(true)
  })
  it('uses the same generic failure for wrong passwords and unknown users', async () => {
    for (const options of [{ exists: false }, { exists: true, passwordAccepted: false }]) {
      const { handler } = fixture(options)
      const response = await handler(request({ action: 'login', username: 'jogador', password: 'wrong-password' }))
      expect(response.status).toBe(401)
      expect(await response.json()).toEqual({ code: 'invalid_credentials' })
    }
  })
  it('rejects duplicate usernames without creating an auth account', async () => {
    const { handler, fetcher } = fixture({ exists: true })
    expect((await handler(request({ action: 'register', username: 'jogador', password: 'my-password' }))).status).toBe(409)
    expect(fetcher.mock.calls.some(([url]) => String(url).endsWith('/admin/users'))).toBe(false)
  })
  it('converts a legacy account only after its current password has been verified', async () => {
    for (const proof of [false,true]) {
      const { handler,fetcher } = fixture({exists:true,legacy:true,legacyProof:proof})
      const result = await handler(request({action:'login',username:'jogador',password:'existing-password'}))
      expect(result.status).toBe(proof ? 200 : 401)
      expect(fetcher.mock.calls.some(([url,init])=>String(url).includes('/admin/users/')&&init?.method==='PUT')).toBe(proof)
    }
  })
  it('fails closed when the persistent rate limiter denies access', async () => {
    const { handler, fetcher } = fixture({ rateAllowed: false })
    expect((await handler(request({ action: 'register', username: 'jogador', password: 'my-password' }))).status).toBe(429)
    expect(fetcher).toHaveBeenCalledTimes(1)
  })
  it('rejects malformed input, oversized bodies and unrecognized API keys', async () => {
    const { handler, fetcher } = fixture()
    expect((await handler(request({ action: 'register', username: 'user@example.com', password: 'my-password' }))).status).toBe(400)
    expect((await handler(request({ action: 'register', username: 'jogador', password: 'x'.repeat(5000) }))).status).toBe(413)
    expect((await handler(request({ action: 'login', username: 'jogador', password: 'pass' }, 'wrong-key'))).status).toBe(403)
    expect(fetcher).not.toHaveBeenCalled()
  })
})
