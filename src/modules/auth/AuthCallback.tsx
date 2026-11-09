import { useState, type FormEvent } from 'react'
import { Link, Navigate, useNavigate } from 'react-router'
import { useAuth } from './AuthProvider'
import { backend } from '../../lib/supabase'
import { Brand } from '../../components/ui/Brand'
import { Button, ErrorNotice, Loading, Notice } from '../../components/ui/primitives'

export function AuthCallback({ password = false }: { password?: boolean }) {
  const auth = useAuth()
  const navigate = useNavigate()
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<unknown>(null)
  const [done, setDone] = useState(false)
  const callbackError = new URLSearchParams(window.location.search).get('error') || new URLSearchParams(window.location.hash.slice(1)).get('error')
  if (auth.loading) return <Loading label="Validando seu acesso…" />
  if (!password && auth.user && !callbackError) return <Navigate to="/" replace />
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setBusy(true); setError(null)
    const data = new FormData(event.currentTarget)
    const value = String(data.get('password'))
    if (value !== data.get('confirm')) { setError({ code: 'weak_password' }); setBusy(false); return }
    try {
      const { error } = await backend().auth.updateUser({ password: value })
      if (error) throw error
      auth.endRecovery(); setDone(true)
    } catch (reason) { setError(reason) } finally { setBusy(false) }
  }
  return <main className="centered-page"><Brand /><section className="panel callback-panel"><h1>{password ? 'Crie sua nova senha' : 'Confirmação de acesso'}</h1>
    {callbackError || !auth.user ? <><p>O link não pôde ser validado. Ele pode ter expirado ou ter sido aberto em outro navegador. Solicite um novo link e abra no navegador em que fez a solicitação.</p><Link className="button button-primary" to={password ? '/recuperar-senha' : '/entrar'}>Voltar para acessar</Link></> : done ? <><Notice>Senha atualizada com sucesso.</Notice><Button onClick={() => navigate('/')}>Ir para minhas campanhas</Button></> : <form className="form-stack" onSubmit={submit}><label>Nova senha<input name="password" type="password" autoComplete="new-password" minLength={12} maxLength={128} required /></label><label>Confirme a senha<input name="confirm" type="password" autoComplete="new-password" minLength={12} maxLength={128} required /></label><p className="help-text">Use pelo menos 12 caracteres. As duas senhas devem ser iguais.</p><ErrorNotice error={error} /><Button type="submit" busy={busy}>Salvar nova senha</Button></form>}
  </section></main>
}
