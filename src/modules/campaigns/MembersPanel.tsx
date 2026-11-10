import { useState, type FormEvent } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Copy, UserPlus, ShieldCheck, Trash2, UsersRound } from 'lucide-react'
import { Badge, Button, Dialog, ErrorNotice, Loading, Notice } from '../../components/ui/primitives'
import { dateLabel, initials } from '../../lib/validation'
import { useAuth } from '../auth/AuthProvider'
import { campaignService } from './service'
import type { Member } from '../../types/database'

function MemberRow({ member, campaignId, gm }: { member: Member; campaignId: string; gm: boolean }) {
  const cache = useQueryClient()
  const { user } = useAuth()
  const [confirm, setConfirm] = useState(false)
  const permission = useMutation({ mutationFn: ({ draw, tokens }: { draw: boolean; tokens: boolean }) => campaignService.permissions(campaignId, member.user_id, draw, tokens), onSuccess: () => cache.invalidateQueries({ queryKey: ['roster', campaignId] }) })
  const remove = useMutation({ mutationFn: () => campaignService.remove(campaignId, member.user_id), onSuccess: async () => { await cache.invalidateQueries(); setConfirm(false) } })
  return <div className="member-row"><div className="member-identity"><span className="avatar">{initials(member.display_name)}</span><div><strong>{member.display_name}{member.user_id === user?.id && <small> (você)</small>}</strong><span>Desde {dateLabel(member.joined_at)}</span></div><Badge tone={member.role === 'gm' ? 'gold' : 'muted'}>{member.role === 'gm' ? 'Mestre' : 'Jogador'}</Badge></div>
    {member.role === 'player' && <div className="member-permissions"><label className="checkbox-label"><input type="checkbox" checked={member.can_draw} disabled={!gm || permission.isPending} onChange={event => permission.mutate({ draw: event.target.checked, tokens: member.can_move_tokens })} />Desenhar</label><label className="checkbox-label"><input type="checkbox" checked={member.can_move_tokens} disabled={!gm || permission.isPending} onChange={event => permission.mutate({ draw: member.can_draw, tokens: event.target.checked })} />Mover próprios tokens</label>{(gm || member.user_id === user?.id) && <Button variant="ghost" aria-label={gm ? `Remover ${member.display_name}` : 'Sair da campanha'} onClick={() => setConfirm(true)}><Trash2 size={16} /></Button>}</div>}
    <ErrorNotice error={permission.error} />
    {confirm && <Dialog title={gm ? 'Remover participante?' : 'Sair da campanha?'} onClose={() => { if (!remove.isPending) setConfirm(false) }}><p>{gm ? `${member.display_name} perderá acesso à campanha. Para voltar, será necessário um novo convite.` : 'Você perderá acesso. O mestre precisará convidar você novamente para voltar.'}</p><ErrorNotice error={remove.error} /><div className="dialog-actions"><Button variant="secondary" disabled={remove.isPending} onClick={() => setConfirm(false)}>Cancelar</Button><Button variant="danger" busy={remove.isPending} onClick={() => remove.mutate()}>{gm ? 'Remover participante' : 'Sair da campanha'}</Button></div></Dialog>}
  </div>
}

export function MembersPanel({ campaignId, gm, archived }: { campaignId: string; gm: boolean; archived: boolean }) {
  const cache = useQueryClient()
  const roster = useQuery({ queryKey: ['roster', campaignId], queryFn: () => campaignService.roster(campaignId) })
  const invites = useQuery({ queryKey: ['campaign-invites', campaignId], queryFn: () => campaignService.pendingInvites(campaignId), enabled: gm })
  const [username, setUsername] = useState('')
  const [copied, setCopied] = useState('')
  const [copyError, setCopyError] = useState(false)
  const invite = useMutation({ mutationFn: () => campaignService.invite(campaignId, username), onSuccess: async () => { setUsername(''); await cache.invalidateQueries({ queryKey: ['campaign-invites', campaignId] }) } })
  const revoke = useMutation({ mutationFn: campaignService.revoke, onSuccess: () => cache.invalidateQueries({ queryKey: ['campaign-invites', campaignId] }) })
  function submit(event: FormEvent) { event.preventDefault(); invite.mutate() }
  async function copy(id: string) {
    try { await navigator.clipboard.writeText(`${window.location.origin}/?convite=${encodeURIComponent(id)}`); setCopied(id); setCopyError(false) } catch { setCopyError(true) }
  }
  return <><section className="panel"><div className="section-heading"><h2><UsersRound size={19} />À mesa <Badge>{roster.data?.length ?? 0}</Badge></h2></div>{roster.isPending ? <Loading /> : roster.isError ? <ErrorNotice error={roster.error} /> : roster.data.map(member => <MemberRow key={member.user_id} member={member} campaignId={campaignId} gm={gm} />)}<p className="help-text permissions-note"><ShieldCheck size={15} />As permissões ficam salvas para a mesa virtual da Fase 2. Cada jogador poderá controlar apenas os tokens autorizados.</p></section>
    {gm && <section className="panel"><div className="section-heading"><h2><UserPlus size={19} />Convidar para a aventura</h2></div><p className="muted">Informe o usuário de quem já criou uma conta. O convite aparecerá para o participante ao entrar.</p>
      <form onSubmit={submit} className="invite-form"><label className="grow">Usuário do participante<input autoCapitalize="none" spellCheck={false} required minLength={3} maxLength={32} value={username} onChange={event => setUsername(event.target.value)} placeholder="usuario_do_jogador" disabled={archived} /></label><Button type="submit" busy={invite.isPending} disabled={archived}>Criar convite</Button></form>
      {archived && <Notice>Reative a campanha para criar novos convites.</Notice>}<ErrorNotice error={invite.error} />{invite.isSuccess && <Notice>Convite criado. Copie o link abaixo para compartilhar.</Notice>}<ErrorNotice error={revoke.error} /><ErrorNotice error={invites.error} />{copyError && <Notice>Não foi possível copiar. Abra a página inicial e compartilhe o endereço do aplicativo com o participante.</Notice>}
      {invites.data?.length ? <div className="pending-invites">{invites.data.map(item => <div className="pending-invite" key={item.id}><div><strong>{item.username ?? 'Participante'}</strong><small>Válido até {dateLabel(item.expires_at)}</small></div><Button variant="ghost" onClick={() => void copy(item.id)}><Copy size={15} />{copied === item.id ? 'Copiado' : 'Copiar link'}</Button><Button variant="ghost" disabled={revoke.isPending} onClick={() => revoke.mutate(item.id)} aria-label={`Revogar convite de ${item.username ?? 'Participante'}`}><Trash2 size={16} /></Button></div>)}</div> : <p className="help-text">Nenhum convite pendente para esta campanha.</p>}
    </section>}
  </>
}
