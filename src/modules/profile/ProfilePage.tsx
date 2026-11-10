import { useState, type FormEvent } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Check, Save, ShieldCheck, UserRound } from 'lucide-react'
import { useProfile } from '../../components/layout/AppLayout'
import { Button, ErrorNotice, Loading, Notice } from '../../components/ui/primitives'
import { backend } from '../../lib/supabase'
import { initials, isHttpsUrl } from '../../lib/validation'
import type { Profile } from '../../types/database'

function ProfileForm({ profile }: { profile: Profile }) {
  const cache = useQueryClient()
  const [name, setName] = useState(profile.display_name)
  const [avatar, setAvatar] = useState(profile.avatar_url ?? '')
  const [invalid, setInvalid] = useState(false)
  const mutation = useMutation({ mutationFn: async () => {
    const { data, error } = await backend().from('profiles').update({ display_name: name.trim(), avatar_url: avatar.trim() || null }).eq('id', profile.id).select('id').single()
    if (error) throw error
    return data
  }, onSuccess: () => cache.invalidateQueries({ queryKey: ['profile'] }) })
  function submit(event: FormEvent) { event.preventDefault(); if (!isHttpsUrl(avatar.trim())) { setInvalid(true); return }; setInvalid(false); mutation.mutate() }
  return <div className="profile-layout"><section className="panel profile-card"><span className="avatar avatar-large">{initials(profile.display_name)}{profile.avatar_url && <img key={profile.avatar_url} src={profile.avatar_url} alt="" referrerPolicy="no-referrer" onError={event => { event.currentTarget.style.display = 'none' }} />}</span><h2>{profile.display_name}</h2><p>{profile.username}</p><span className="profile-role"><ShieldCheck size={15} />Conta autenticada</span></section><section className="panel"><div className="section-heading"><h2><UserRound size={18} />Como o grupo vê você</h2></div><form onSubmit={submit} className="form-stack"><label>Nome de exibição<input required minLength={2} maxLength={60} value={name} onChange={event => setName(event.target.value)} autoComplete="nickname" /></label><label>URL da foto <span className="optional">opcional</span><input type="url" value={avatar} onChange={event => setAvatar(event.target.value)} maxLength={2048} placeholder="https://…" aria-describedby="avatar-help" /><small id="avatar-help" className="help-text">Use uma imagem hospedada em HTTPS. Upload de arquivos será incluído em uma próxima fase. O provedor da imagem receberá a requisição do seu navegador.</small></label>{invalid && <div role="alert" className="notice notice-error">Use uma URL HTTPS válida para a imagem.</div>}<label>Usuário<input value={profile.username ?? ''} disabled /><small className="help-text">Use este nome para entrar e receber convites do grupo.</small></label><ErrorNotice error={mutation.error} />{mutation.isSuccess && <Notice><Check size={17} />Perfil atualizado.</Notice>}<div><Button type="submit" busy={mutation.isPending}><Save size={16} />Salvar perfil</Button></div></form></section></div>
}
export function ProfilePage() {
  const profile = useProfile()
  return <><div className="page-heading"><div><h1>Perfil</h1></div></div>{profile.isPending ? <Loading /> : profile.isError ? <ErrorNotice error={profile.error} /> : <ProfileForm profile={profile.data} />}</>
}
