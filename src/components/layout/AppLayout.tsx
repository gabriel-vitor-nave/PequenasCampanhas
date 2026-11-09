import { useEffect, useState } from 'react'
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router'
import { BookOpen, ChevronRight, Compass, Home, LogOut, Menu, Settings2, UserRound, X } from 'lucide-react'
import { useQuery } from '@tanstack/react-query'
import { Brand } from '../ui/Brand'
import { Button, ErrorNotice } from '../ui/primitives'
import { backend } from '../../lib/supabase'
import { initials } from '../../lib/validation'
import { useAuth } from '../../modules/auth/AuthProvider'
import { useCampaignRealtime } from '../../modules/campaigns/hooks'
import { useUI } from '../../stores/ui'

export function useProfile() {
  const { user } = useAuth()
  return useQuery({ queryKey: ['profile', user?.id], enabled: !!user, queryFn: async () => {
    const { data, error } = await backend().from('profiles').select('*').eq('id', user!.id).single()
    if (error) throw error
    return data
  } })
}
const navigation = [
  { to: '/', label: 'Início', icon: Home, end: true },
  { to: '/campanhas', label: 'Campanhas', icon: Compass, end: false },
  { to: '/biblioteca', label: 'Biblioteca', icon: BookOpen, end: false },
]
export function AppLayout() {
  const location = useLocation()
  const navigate = useNavigate()
  const { sidebarOpen, setSidebarOpen } = useUI()
  const { user } = useAuth()
  const profile = useProfile()
  const [error, setError] = useState<unknown>(null)
  const [busy, setBusy] = useState(false)
  useCampaignRealtime()
  useEffect(() => { setSidebarOpen(false) }, [location.pathname, setSidebarOpen])
  useEffect(() => {
    if (!sidebarOpen) return
    const escape = (event: KeyboardEvent) => { if (event.key === 'Escape') setSidebarOpen(false) }
    window.addEventListener('keydown', escape)
    return () => window.removeEventListener('keydown', escape)
  }, [sidebarOpen, setSidebarOpen])
  async function signOut() {
    setBusy(true); setError(null)
    // Local logout revokes the current session without signing out other devices.
    const { error } = await backend().auth.signOut({ scope: 'local' })
    setBusy(false)
    if (error) setError(error)
    else navigate('/entrar')
  }
  const compact = !!(profile.data?.preferences && typeof profile.data.preferences === 'object' && !Array.isArray(profile.data.preferences) && profile.data.preferences.compact)
  const name = profile.data?.display_name ?? 'Minha conta'
  return <div className={`app-shell ${compact ? 'compact' : ''}`}>
    {sidebarOpen && <button className="sidebar-scrim" aria-label="Fechar navegação" onClick={() => setSidebarOpen(false)} />}
    <aside className={`sidebar ${sidebarOpen ? 'is-open' : ''}`} aria-label="Navegação principal"><div className="sidebar-brand"><Brand /><Button variant="ghost" className="mobile-close" aria-label="Fechar menu" onClick={() => setSidebarOpen(false)}><X size={19} /></Button></div>
      <div className="workspace-label">SEU ESPAÇO DE AVENTURAS</div><nav>{navigation.map(({ to, label, icon: Icon, end }) => <NavLink key={to} to={to} end={end} className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}><Icon size={18} strokeWidth={1.7} />{label}{to === '/campanhas' && <ChevronRight size={14} className="nav-chevron" />}</NavLink>)}</nav>
      <div className="sidebar-note"><span className="small-rule" /><p>Histórias melhores<br />começam em boa companhia.</p><span>Pequenas Campanhas</span></div>
      <nav className="sidebar-bottom"><NavLink to="/perfil" className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}><UserRound size={18} />Perfil</NavLink><NavLink to="/configuracoes" className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}><Settings2 size={18} />Configurações</NavLink></nav>
      <div className="account-block"><NavLink to="/perfil" className="account-link"><span className="avatar">{initials(name)}</span><span><strong>{name}</strong><small>{user?.email}</small></span></NavLink><Button variant="ghost" onClick={() => void signOut()} busy={busy} aria-label="Sair da conta"><LogOut size={17} /></Button></div><ErrorNotice error={error} />
    </aside><div className="app-body"><header className="topbar"><Button variant="ghost" className="mobile-menu" onClick={() => setSidebarOpen(true)} aria-expanded={sidebarOpen} aria-label="Abrir menu"><Menu size={21} /></Button><div className="breadcrumb">Meu espaço <ChevronRight size={13} /><span>{location.pathname === '/' ? 'Início' : location.pathname.startsWith('/campanhas/') ? 'Campanha' : location.pathname === '/campanhas' ? 'Campanhas' : location.pathname === '/perfil' ? 'Perfil' : location.pathname === '/biblioteca' ? 'Biblioteca' : 'Configurações'}</span></div><span className="topbar-caption">Dê vida à próxima história.</span></header>
      <main id="main-content" className="main-content"><Outlet /></main><footer className="app-footer"><span>Pequenas Campanhas</span><span>Feito para jogar junto.</span></footer>
    </div></div>
}
