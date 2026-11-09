import { describe, expect, it } from 'vitest'
import { readConfig } from './config'
import { safeReturnPath, campaignInput, isHttpsUrl } from './validation'

describe('public backend configuration', () => {
  const env = { VITE_SUPABASE_URL: 'https://example.supabase.co', VITE_SUPABASE_PUBLISHABLE_KEY: 'sb_publishable_test' }
  it('requires actual public configuration', () => {
    expect(readConfig({})).toBeNull()
    expect(readConfig({ ...env, VITE_SUPABASE_URL: 'https://YOUR_PROJECT.supabase.co' })).toBeNull()
    expect(readConfig(env)).toEqual({ url: env.VITE_SUPABASE_URL, key: env.VITE_SUPABASE_PUBLISHABLE_KEY })
  })
  it('rejects insecure remote URLs and administrative keys', () => {
    expect(readConfig({ ...env, VITE_SUPABASE_URL: 'http://example.com' })).toBeNull()
    expect(readConfig({ ...env, VITE_SUPABASE_PUBLISHABLE_KEY: 'sb_secret_test' })).toBeNull()
    const jwt = `header.${btoa(JSON.stringify({ role: 'service_role' }))}.signature`
    expect(readConfig({ ...env, VITE_SUPABASE_PUBLISHABLE_KEY: jwt })).toBeNull()
    expect(readConfig({ ...env, VITE_SUPABASE_URL: 'http://127.0.0.1:54321' })).not.toBeNull()
  })
})
describe('user input', () => {
  it('validates names after trimming and enforces description limits', () => {
    expect(() => campaignInput('  ab  ', '')).toThrow()
    expect(() => campaignInput('Minha campanha', 'a'.repeat(2001))).toThrow()
    expect(campaignInput('  Minha campanha  ', ' Olá ')).toEqual({ name: 'Minha campanha', description: 'Olá' })
  })
  it('rejects unsafe avatar protocols', () => {
    expect(isHttpsUrl('javascript:alert(1)')).toBe(false)
    expect(isHttpsUrl('http://example.com/avatar.png')).toBe(false)
    expect(isHttpsUrl('https://example.com/avatar.png')).toBe(true)
  })
  it('keeps login redirects inside the application', () => {
    for (const value of ['//evil.com', '/\\evil.com', 'https://evil.com', '/\nevil', null]) expect(safeReturnPath(value)).toBe('/')
    expect(safeReturnPath('/campanhas?convite=123')).toBe('/campanhas?convite=123')
  })
})
