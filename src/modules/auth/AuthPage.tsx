import { useState, type FormEvent } from 'react'
import { Link, Navigate, useLocation, useSearchParams } from 'react-router'
import { ArrowLeft, ArrowRight, Mail } from 'lucide-react'
import { backend } from '../../lib/supabase'
import { safeReturnPath } from '../../lib/validation'
import { Brand } from '../../components/ui/Brand'
import { Button, ErrorNotice, Loading, Notice } from '../../components/ui/primitives'
import { useAuth } from './AuthProvider'

export function AuthPage() {
  const { user, loading } = useAuth()
  const location = useLocation()
  const [params] = useSearchParams()
  const register = location.pathname === '/cadastro'
  const reset = location.pathname === '/recuperar-senha'
  const next = safeReturnPath(params.get('next'))
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<unknown>(null)
  const [message, setMessage] = useState('')
  if (loading) return <Loading />
  if (user) return <Navigate to={next} replace />
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setError(null); setMessage(''); setBusy(true)
    const data = new FormData(event.currentTarget)
    const email = String(data.get('email')).trim()
    try {
      if (reset) {
        const { error } = await backend().auth.resetPasswordForEmail(email, { redirectTo: `${window.location.origin}/auth/nova-senha` })
        if (error) throw error
        setMessage('Se este e-mail possuir uma conta, você receberá um link para criar uma nova senha.')
      } else if (register) {
        const { error } = await backend().auth.signUp({ email, password: String(data.get('password')), options: { data: { display_name: String(data.get('name')).trim() }, emailRedirectTo: `${window.location.origin}/auth/callback` } })
        if (error) throw error
        setMessage('Confira sua caixa de entrada para confirmar o e-mail. Depois, entre na sua conta.')
      } else {
        const { error } = await backend().auth.signInWithPassword({ email, password: String(data.get('password')) })
        if (error) throw error
      }
    } catch (reason) { setError(reason) } finally { setBusy(false) }
  }
  const query = next === '/' ? '' : `?next=${encodeURIComponent(next)}`
  return <main className="auth-page"><div className="auth-intro"><Brand /><div><span className="eyebrow">O PRÓXIMO CAPÍTULO É SEU</span><h1>Pequenas campanhas.<br />Histórias que ficam.</h1><p>Reúna seu grupo, prepare a aventura<br />e dê espaço à imaginação.</p></div><span className="auth-footnote">Feito para quem gosta de jogar junto.</span></div>
    <section className="auth-panel"><div className="auth-form"><span className="eyebrow">BEM-VINDO À MESA</span><h2>{reset ? 'Recupere seu acesso' : register ? 'Crie sua conta' : 'Sua aventura continua.'}</h2><p className="muted">{reset ? 'Enviaremos um link de recuperação por e-mail.' : register ? 'Um lugar para todas as suas campanhas.' : 'Entre para encontrar suas campanhas e seu grupo.'}</p>
      <form onSubmit={submit} className="form-stack" key={location.pathname}>
        {register && <label>Nome de exibição<input name="name" autoComplete="nickname" minLength={2} maxLength={60} required placeholder="Como seu grupo chama você?" /></label>}
        <label>E-mail<input type="email" name="email" autoComplete="email" maxLength={254} required placeholder="voce@exemplo.com" /></label>
        {!reset && <label>Senha<input type="password" name="password" autoComplete={register ? 'new-password' : 'current-password'} minLength={register ? 12 : 1} maxLength={128} required placeholder={register ? 'Pelo menos 12 caracteres' : 'Sua senha'} /></label>}
        {!register && !reset && <Link className="form-link" to="/recuperar-senha">Esqueci minha senha</Link>}
        <ErrorNotice error={error} />{message && <Notice><Mail size={18} />{message}</Notice>}
        <Button type="submit" busy={busy}>{reset ? 'Enviar link de recuperação' : register ? 'Criar conta' : 'Entrar na plataforma'}<ArrowRight size={16} /></Button>
      </form>
      <div className="auth-switch">{reset ? <Link to={`/entrar${query}`}><ArrowLeft size={15} />Voltar para entrar</Link> : register ? <>Já tem uma conta? <Link to={`/entrar${query}`}>Entrar</Link></> : <>Ainda não tem uma conta? <Link to={`/cadastro${query}`}>Criar conta</Link></>}</div>
    </div></section></main>
}
