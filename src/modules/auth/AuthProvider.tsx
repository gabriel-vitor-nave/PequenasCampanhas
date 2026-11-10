import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import type { Session, User } from '@supabase/supabase-js'
import { useQueryClient } from '@tanstack/react-query'
import { supabase } from '../../lib/supabase'

type AuthState = { user: User | null; session: Session | null; loading: boolean; error: unknown }
const AuthContext = createContext<AuthState | null>(null)
export function AuthProvider({ children }: { children: ReactNode }) {
  const cache = useQueryClient()
  const [session, setSession] = useState<Session | null>(null)
  const [loading, setLoading] = useState(!!supabase)
  const [error, setError] = useState<unknown>(null)
  useEffect(() => {
    if (!supabase) return
    let alive = true
    let authVersion = 0
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, next) => {
      if (!alive) return
      authVersion++
      setError(null)
      if (event === 'SIGNED_OUT') cache.clear()
      setSession(next)
      setLoading(false)
    })
    const requestVersion = authVersion
    void supabase.auth.getSession().then(({ data, error: authError }) => {
      if (alive && requestVersion === authVersion) { setSession(data.session); setError(authError); setLoading(false) }
    }).catch(reason => { if (alive) { setError(reason); setLoading(false) } })
    return () => { alive = false; subscription.unsubscribe() }
  }, [cache])
  return <AuthContext.Provider value={{ user: session?.user ?? null, session, loading, error }}>{children}</AuthContext.Provider>
}
export function useAuth() {
  const context = useContext(AuthContext)
  if (!context) throw new Error('AuthProvider ausente')
  return context
}
