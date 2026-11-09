import { Component, type ErrorInfo, type ReactNode } from 'react'
import { BrowserRouter, Link, Navigate, Outlet, Route, Routes, useLocation } from 'react-router'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { AuthProvider, useAuth } from '../modules/auth/AuthProvider'
import { AuthPage } from '../modules/auth/AuthPage'
import { AuthCallback } from '../modules/auth/AuthCallback'
import { config } from '../lib/supabase'
import { AppLayout } from '../components/layout/AppLayout'
import { ErrorNotice, Loading } from '../components/ui/primitives'
import { SetupPage } from './SetupPage'
import { HomePage } from './HomePage'
import { SettingsPage } from './SettingsPage'
import { LibraryPage } from './LibraryPage'
import { CampaignsPage } from '../modules/campaigns/CampaignsPage'
import { CampaignDetailPage } from '../modules/campaigns/CampaignDetailPage'
import { ProfilePage } from '../modules/profile/ProfilePage'

const queryClient = new QueryClient({ defaultOptions: { queries: { staleTime: 15_000, refetchOnWindowFocus: true, refetchOnReconnect: true, retry: 1, refetchInterval: 60_000 }, mutations: { retry: false } } })
function RequireAuth() {
  const { user, loading, error, recovery } = useAuth()
  const location = useLocation()
  if (loading) return <Loading label="Preparando seu espaço…" />
  if (error) return <div className="centered-page"><ErrorNotice error={error} /><Link to="/entrar">Voltar para entrar</Link></div>
  if (!user) return <Navigate replace to={`/entrar?next=${encodeURIComponent(location.pathname + location.search)}`} />
  if (recovery) return <Navigate replace to="/auth/nova-senha" />
  return <Outlet />
}
class ErrorBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false }
  static getDerivedStateFromError() { return { failed: true } }
  componentDidCatch(_error: Error, _info: ErrorInfo) { /* Error details must not include user/session data in production. */ }
  render() { return this.state.failed ? <main className="centered-page"><h1>Não foi possível abrir a página.</h1><p>Recarregue para tentar novamente. Seus dados salvos estão no Supabase.</p><button className="button button-primary" onClick={() => window.location.reload()}>Recarregar</button></main> : this.props.children }
}
export function App() {
  return <ErrorBoundary><QueryClientProvider client={queryClient}><BrowserRouter><a className="skip-link" href="#main-content">Pular para o conteúdo</a>{!config ? <SetupPage /> : <AuthProvider><Routes>
    <Route path="/entrar" element={<AuthPage />} /><Route path="/cadastro" element={<AuthPage />} /><Route path="/recuperar-senha" element={<AuthPage />} />
    <Route path="/auth/callback" element={<AuthCallback />} /><Route path="/auth/nova-senha" element={<AuthCallback password />} />
    <Route element={<RequireAuth />}><Route element={<AppLayout />}><Route index element={<HomePage />} /><Route path="campanhas" element={<CampaignsPage />} /><Route path="campanhas/:id" element={<CampaignDetailPage />} /><Route path="perfil" element={<ProfilePage />} /><Route path="configuracoes" element={<SettingsPage />} /><Route path="biblioteca" element={<LibraryPage />} /><Route path="*" element={<div className="panel"><h1>Este caminho ainda não foi explorado.</h1><Link className="text-link" to="/">Voltar para o início</Link></div>} /></Route></Route>
  </Routes></AuthProvider>}</BrowserRouter></QueryClientProvider></ErrorBoundary>
}
