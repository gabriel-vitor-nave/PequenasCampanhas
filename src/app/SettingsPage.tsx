import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Monitor, ShieldCheck } from 'lucide-react'
import { useProfile } from '../components/layout/AppLayout'
import { ErrorNotice, Loading, Notice } from '../components/ui/primitives'
import { backend } from '../lib/supabase'

export function SettingsPage() {
  const profile = useProfile()
  const cache = useQueryClient()
  const mutation = useMutation({ mutationFn: async (compact: boolean) => {
    if (!profile.data) return
    const { error } = await backend().from('profiles').update({ preferences: { compact } }).eq('id', profile.data.id).select('id').single()
    if (error) throw error
  }, onSuccess: () => cache.invalidateQueries({ queryKey: ['profile'] }) })
  const preferences = profile.data?.preferences
  const compact = !!(preferences && typeof preferences === 'object' && !Array.isArray(preferences) && preferences.compact)
  return <><div className="page-heading"><div><h1>Configurações</h1></div></div>{profile.isPending ? <Loading /> : profile.isError ? <ErrorNotice error={profile.error} /> : <section className="panel settings-panel"><h2><Monitor size={19} />Interface</h2><div className="setting-row"><div><strong>Modo compacto</strong><p>Reduz os espaços entre elementos para mostrar mais conteúdo.</p></div><label className="switch"><input type="checkbox" aria-label="Modo compacto" checked={compact} disabled={mutation.isPending} onChange={event => mutation.mutate(event.target.checked)} /><span /></label></div><ErrorNotice error={mutation.error} />{mutation.isSuccess && <Notice>Preferência salva na sua conta.</Notice>}</section>}<section className="panel settings-panel"><h2><ShieldCheck size={19} />Sua conta e seus dados</h2><p className="muted">Suas campanhas são acessíveis apenas aos participantes autorizados. O mestre administra os convites e as permissões dentro de cada campanha.</p><p className="help-text">As preferências são salvas automaticamente. A comunicação por voz continua no Discord.</p></section></>
}
