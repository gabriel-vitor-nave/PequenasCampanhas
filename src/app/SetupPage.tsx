import { ArrowUpRight, Database, KeyRound, Terminal, BookOpen } from 'lucide-react'
import { Brand } from '../components/ui/Brand'
import { Badge } from '../components/ui/primitives'

export function SetupPage() {
  return <main className="setup-page"><header className="setup-header"><Brand /><Badge>Configuração inicial</Badge></header>
    <div className="setup-content"><div className="eyebrow">UM LUGAR PARA AS SUAS HISTÓRIAS</div><h1>Toda grande aventura<br />começa com um encontro.</h1><p className="lead">A fundação está pronta para conectar seu grupo.<br />Configure o Supabase para começar a criar campanhas.</p>
      <section className="setup-card" aria-labelledby="setup-title"><div className="section-heading"><h2 id="setup-title">Conecte sua plataforma</h2><Badge tone="gold">Fase 1 · Fundação</Badge></div>
        <ol className="setup-steps"><li><Database /><div><h3>Prepare o banco de dados</h3><p>Crie um projeto Supabase e aplique as migrations da pasta <code>supabase/migrations</code>.</p></div><span>01</span></li>
          <li><KeyRound /><div><h3>Configure as variáveis públicas</h3><p>Copie <code>.env.example</code> para <code>.env.local</code> e preencha a URL e a chave publicável.</p></div><span>02</span></li>
          <li><Terminal /><div><h3>Inicie a sua primeira campanha</h3><p>Reinicie com <code>pnpm dev</code>, crie sua conta e convide seu grupo.</p></div><span>03</span></li></ol>
        <div className="setup-code"><code>VITE_SUPABASE_URL<br />VITE_SUPABASE_PUBLISHABLE_KEY</code><span>Somente credenciais públicas</span></div>
        <p className="help-text">Não use chaves secretas ou service_role no navegador. O acesso usa somente usuário e senha; consulte o README para publicar a função de acesso.</p>
      </section><div className="setup-footer"><span><BookOpen size={16} /> Sem campanhas fictícias. Seus dados ficam no seu Supabase.</span><a href="https://supabase.com/dashboard" target="_blank" rel="noreferrer">Abrir Supabase <ArrowUpRight size={16} /></a></div>
    </div><footer className="quiet-footer">Pequenas Campanhas <span>Seu grupo. Suas histórias.</span></footer>
  </main>
}
