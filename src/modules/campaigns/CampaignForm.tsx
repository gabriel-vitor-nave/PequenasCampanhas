import { useState, type FormEvent } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useNavigate } from 'react-router'
import { ArrowRight, BookOpen } from 'lucide-react'
import { Button, Dialog, ErrorNotice } from '../../components/ui/primitives'
import { campaignService } from './service'
import type { Campaign } from '../../types/database'

export function CampaignForm({ campaign, onClose }: { campaign?: Campaign; onClose: () => void }) {
  const cache = useQueryClient()
  const navigate = useNavigate()
  const [name, setName] = useState(campaign?.name ?? '')
  const [description, setDescription] = useState(campaign?.description ?? '')
  const mutation = useMutation({ mutationFn: async () => campaign ? (await campaignService.update(campaign.id, { name: name.trim(), description: description.trim() })).id : campaignService.create(name, description), onSuccess: async id => {
    await cache.invalidateQueries(); onClose(); if (!campaign) navigate(`/campanhas/${id}`)
  } })
  function submit(event: FormEvent) { event.preventDefault(); mutation.mutate() }
  return <Dialog title={campaign ? 'Editar campanha' : 'Nova campanha'} onClose={() => { if (!mutation.isPending) onClose() }}><form className="form-stack" onSubmit={submit}>

    <label>Nome da campanha<input name="name" autoFocus required minLength={3} maxLength={80} value={name} onChange={event => setName(event.target.value)} placeholder="Nome" /></label>
    <label>Descrição <span className="optional">opcional</span><textarea rows={4} maxLength={2000} value={description} onChange={event => setDescription(event.target.value)} placeholder="Descrição da campanha" /><small className="field-count">{description.length}/2.000</small></label>
    <div className="system-field"><BookOpen size={19} /><span><strong>Dungeons & Dragons</strong><small>5ª edição · Regras de 2024</small></span><span className="badge">Sistema inicial</span></div>
    <ErrorNotice error={mutation.error} /><div className="dialog-actions"><Button type="button" variant="secondary" disabled={mutation.isPending} onClick={onClose}>Cancelar</Button><Button type="submit" busy={mutation.isPending}>{campaign ? 'Salvar alterações' : 'Criar campanha'}<ArrowRight size={16} /></Button></div>
  </form></Dialog>
}
