import { backend } from '../../lib/supabase'
import { normalizeUsername, validUsername, validNewPassword } from '../../../shared/credentials'

export const accountService = {
  async authenticate(action: 'register' | 'login', usernameInput: string, password: string) {
    const username = normalizeUsername(usernameInput)
    if (!validUsername(username)) throw new Error('PC_INVALID_USERNAME')
    if (action === 'register' && !validNewPassword(password)) throw new Error('weak_password')
    const { data, error } = await backend().functions.invoke('account-access', { body: { action, username, password } })
    if (error) {
      if ('context' in error && error.context instanceof Response) {
        try { const body = await error.context.json() as { code?: string }; if (body.code) throw new Error(body.code) }
        catch (reason) { if (reason instanceof Error && (reason.message.startsWith('PC_') || reason.message === 'invalid_credentials' || reason.message === 'weak_password')) throw reason }
      }
      throw error
    }
    const session = (data as { session?: { access_token?: string; refresh_token?: string } } | null)?.session
    if (!session?.access_token || !session.refresh_token) throw new Error('PC_AUTH_UNAVAILABLE')
    const result = await backend().auth.setSession({ access_token: session.access_token, refresh_token: session.refresh_token })
    if (result.error) throw result.error
  },
}
