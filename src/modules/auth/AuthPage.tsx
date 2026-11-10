import { useState, type FormEvent } from 'react'
import { Link, Navigate, useLocation, useSearchParams } from 'react-router'
import { ArrowRight } from 'lucide-react'
import { accountService } from './service'
import { safeReturnPath } from '../../lib/validation'
import { Brand } from '../../components/ui/Brand'
import { Button, ErrorNotice, Loading } from '../../components/ui/primitives'
import { useAuth } from './AuthProvider'

export function AuthPage() {
  const { user, loading } = useAuth()
  const location = useLocation()
  const [params] = useSearchParams()
  const register = location.pathname === '/cadastro'
  const next = safeReturnPath(params.get('next'))
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<unknown>(null)
  if (loading) return <Loading />
  if (user) return <Navigate to={next} replace />
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setError(null); setBusy(true)
    const data = new FormData(event.currentTarget)
    try {
      await accountService.authenticate(register ? 'register' : 'login', String(data.get('username')), String(data.get('password')))
    } catch (reason) { setError(reason) } finally { setBusy(false) }
  }
  const query = next === '/' ? '' : `?next=${encodeURIComponent(next)}`
  return <main className="auth-page"><div className="auth-intro"><Brand /><div><span className="eyebrow">O PRÓXIMO CAPÍTULO É SEU</span><h1>Pequenas campanhas.<br />Histórias que ficam.</h1><p>Reúna seu grupo, prepare a aventura<br />e dê espaço à imaginação.</p></div><span className="auth-footnote">Feito para quem gosta de jogar junto.</span></div>
    <section className="auth-panel"><div className="auth-form"><span className="eyebrow">BEM-VINDO À MESA</span><h2>{register ? 'Crie sua conta' : 'Sua aventura continua.'}</h2><p className="muted">{register ? 'Escolha seu usuário e uma senha para começar.' : 'Entre para encontrar suas campanhas e seu grupo.'}</p>
      <form onSubmit={submit} className="form-stack" key={location.pathname}>
        <label>Usuário<input aria-label="Usuário" name="username" autoComplete="username" autoCapitalize="none" spellCheck={false} minLength={3} maxLength={32} pattern="[a-zA-Z0-9][a-zA-Z0-9._\-]{2,31}" required placeholder="seu_usuario" aria-describedby={register ? 'username-help' : undefined} />{register && <small id="username-help" className="help-text">De 3 a 32 letras, números, pontos, traços ou sublinhados.</small>}</label>
        <label>Senha<input type="password" name="password" autoComplete={register ? 'new-password' : 'current-password'} minLength={register ? 8 : 1} maxLength={72} required placeholder={register ? 'Pelo menos 8 caracteres' : 'Sua senha'} /></label>
        <ErrorNotice error={error} />
        <Button type="submit" busy={busy}>{register ? 'Criar conta e entrar' : 'Entrar'}<ArrowRight size={16} /></Button>
      </form>
      <div className="auth-switch">{register ? <>Já tem uma conta? <Link to={`/entrar${query}`}>Entrar</Link></> : <>Ainda não tem uma conta? <Link to={`/cadastro${query}`}>Criar conta</Link></>}</div>
    </div></section></main>
}
