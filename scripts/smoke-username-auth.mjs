// Explicit hosted integration check. Creates one disposable account; remove it after the run.
// Never prints passwords or access/refresh tokens.
import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import { deployedBackend as config } from '../src/lib/deployment.ts'

const username = 'pc_check_' + randomUUID().replaceAll('-', '').slice(0, 12)
const password = randomUUID() + 'Aa1!'
const url = config.VITE_SUPABASE_URL
const headers = { 'Content-Type': 'application/json', apikey: config.VITE_SUPABASE_PUBLISHABLE_KEY }
console.log('Disposable integration username: ' + username)
async function access(action, value = password) {
  const response = await fetch(url + '/functions/v1/account-access', { method: 'POST', headers, body: JSON.stringify({ action, username, password: value }) })
  const data = await response.json()
  return { status: response.status, data }
}
const registration = await access('register')
assert.equal(registration.status, 200, JSON.stringify({ status: registration.status, code: registration.data.code }))
assert.equal(typeof registration.data.session?.access_token, 'string')
const token = registration.data.session.access_token
const identity = await fetch(url + '/auth/v1/user', { headers: { ...headers, Authorization: 'Bearer ' + token } }).then(r => r.json())
assert.equal(typeof identity.id, 'string')
const profile = await fetch(url + '/rest/v1/profiles?select=id,username', { headers: { ...headers, Authorization: 'Bearer ' + token } }).then(r => r.json())
assert.equal(profile[0]?.username, username)
assert.equal((await access('login', 'definitely-the-wrong-password')).status, 401)
assert.equal((await access('register')).status, 409)
const login = await access('login')
assert.equal(login.status, 200, JSON.stringify({ status: login.status, code: login.data.code }))
const secondIdentity = await fetch(url + '/auth/v1/user', { headers: { ...headers, Authorization: 'Bearer ' + login.data.session.access_token } }).then(r => r.json())
assert.equal(secondIdentity.id, identity.id)
console.log(JSON.stringify({ passed: ['register_without_email', 'immediate_session', 'own_profile', 'wrong_password_denied', 'duplicate_username_denied', 'password_login'], disposableUserId: identity.id, username }))
