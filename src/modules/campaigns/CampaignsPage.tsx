import { useState } from 'react'
import { Compass, Plus, Search } from 'lucide-react'
import { Badge, Button, EmptyState, ErrorNotice, Loading } from '../../components/ui/primitives'
import { useCampaigns } from './hooks'
import { CampaignCard } from './CampaignCard'
import { CampaignForm } from './CampaignForm'

export function CampaignsPage() {
  const query = useCampaigns()
  const [create, setCreate] = useState(false)
  const [filter, setFilter] = useState('active')
  const [search, setSearch] = useState('')
  const campaigns = query.data?.filter(campaign => (filter === 'all' || campaign.status === filter) && campaign.name.toLocaleLowerCase('pt-BR').includes(search.toLocaleLowerCase('pt-BR'))) ?? []
  return <><div className="page-heading"><div><div className="eyebrow">AVENTURAS COMPARTILHADAS</div><h1>Suas campanhas<span className="heading-dot">.</span></h1><p>Cada mesa, um novo mundo para descobrir.</p></div><Button onClick={() => setCreate(true)}><Plus size={17} />Nova campanha</Button></div>
    <div className="collection-toolbar"><div className="segmented" aria-label="Filtrar campanhas">{[['active','Em andamento'],['archived','Arquivadas'],['all','Todas']].map(([value, label]) => <button key={value} className={filter === value ? 'selected' : ''} aria-pressed={filter === value} onClick={() => setFilter(value)}>{label}{value === 'all' && <Badge>{query.data?.length ?? 0}</Badge>}</button>)}</div><label className="search-field"><Search size={17} /><input aria-label="Buscar campanha" placeholder="Buscar campanha…" value={search} onChange={event => setSearch(event.target.value)} /></label></div>
    {query.isPending ? <Loading /> : query.isError ? <><ErrorNotice error={query.error} /><Button variant="secondary" onClick={() => void query.refetch()}>Tentar novamente</Button></> : campaigns.length ? <div className="campaign-grid">{campaigns.map(campaign => <CampaignCard key={campaign.id} campaign={campaign} />)}</div> : <EmptyState icon={<Compass size={34} strokeWidth={1.3} />} title={search || filter === 'archived' ? 'Nenhuma campanha encontrada' : 'A próxima história começa com você.'} action={!search && filter !== 'archived' && <Button onClick={() => setCreate(true)}><Plus size={16} />Criar minha primeira campanha</Button>}>{search ? 'Experimente outro nome ou altere os filtros.' : filter === 'archived' ? 'Campanhas arquivadas ficam guardadas aqui e podem ser reativadas.' : 'Crie uma campanha para reunir o grupo ou aceite um convite na página inicial.'}</EmptyState>}
    {create && <CampaignForm onClose={() => setCreate(false)} />}
  </>
}
