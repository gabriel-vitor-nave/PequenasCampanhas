# Arquitetura e segurança — Fase 1

## Separação de responsabilidades

React compõe páginas e controles. React Router protege as rotas com uma sessão Supabase e conserva o caminho de destino sem permitir redirecionamento externo. Zustand contém somente a abertura do menu; dados persistidos permanecem no PostgreSQL. TanStack Query gerencia consultas, erros, invalidação e reconexão; o cliente Supabase tipado fica em `src/lib`.

O frontend nunca é autoridade para permissões. Todas as tabelas têm RLS e o papel `anon` não tem acesso. Colunas protegidas, como proprietário e papel, não possuem concessão de escrita para `authenticated`. As RPCs privilegiadas usam `SECURITY DEFINER`, `search_path` vazio, nomes qualificados e identidade derivada de `auth.uid()`. Não recebem um identificador arbitrário de usuário como identidade do solicitante.

Após a revisão hospedada, as implementações privilegiadas foram movidas para `private`, com entradas `SECURITY INVOKER` em `public`. O schema `private` não é exposto pela Data API. A autorização permanece dentro de cada implementação; a revisão de segurança hospedada ficou sem alertas.

## Modelo implementado

| Entidade | Responsabilidade | Relações |
| --- | --- | --- |
| `auth.users` | Identidade interna, hash de senha e sessão, gerenciados pelo Supabase | Um perfil por usuário |
| `profiles` | Usuário imutável, nome, URL HTTPS de avatar e preferências | `id → auth.users.id` |
| `campaigns` | Nome, descrição, sistema, estado e proprietário imutável | `owner_id → profiles.id` |
| `campaign_members` | Participação, mestre/jogador e permissões iniciais | Chave `(campaign_id, user_id)` |
| `campaign_invites` | Convite por nome de usuário vinculado ao ID da conta | Campanha, destinatário, remetente, status e vencimento |
| `activity_logs` | Eventos de campanha/participantes | Campanha e ator |

Excluir uma campanha remove membros, convites e atividades por cascata. O mestre proprietário não pode sair ou ser removido; nesta fase não existe transferência de propriedade nem promoção de outros mestres. Excluir a identidade proprietária administrativamente também exclui suas campanhas por cascata: essa operação requer recuperação/backup antes de ser executada e não está disponível na interface.

## Regras de acesso

| Recurso | Mestre | Jogador | Pessoa fora da campanha |
| --- | --- | --- | --- |
| Campanha e histórico | Ler e editar a campanha; excluir como proprietário | Ler | Sem acesso |
| Participantes e perfis do grupo | Ler, remover jogador, configurar permissões | Ler; sair da própria participação | Sem acesso |
| Convites | Criar, consultar e revogar | Apenas convites destinados à própria conta | Apenas o convite destinado à própria conta |
| Perfil | Editar o próprio; ler perfis compartilhados | Editar o próprio; ler perfis compartilhados | Apenas o próprio |

O nome de usuário é resolvido pelo servidor e o convite é vinculado ao ID da conta. O UUID do link não concede acesso. `my_invitations` expõe somente o nome da campanha e os dados necessários ao destinatário, sem liberar a leitura da campanha antes do aceite. Os campos legados de identidade não aparecem na interface.

Criação de campanha + participação do mestre é atômica. Aceite de convite bloqueia campanha e convite, valida vencimento/status/destinatário e insere somente papel `player`; não permite reaproveitamento nem substitui um papel existente. Criação/aceite/revogação usam a mesma ordem de bloqueios. A campanha admite até 20 convites pendentes; duplicações são impedidas por índice único parcial. Estados arquivados bloqueiam novos convites e novos aceites.

## Permissões e entidades futuras

`can_draw` e `can_move_tokens` são preferências reais, persistidas e alteradas somente pelo mestre. Sua aplicação a objetos gráficos começa na Fase 2, junto à propriedade de tokens e às permissões por recurso. **Não há recursos gráficos com autorização apenas na interface.** Eles ainda não estão implementados.

As próximas migrations adicionarão sessões, cenas, mapas, camadas, objetos, desenhos, fichas, inventários, magias, condições, monstros, NPCs, encontros, combatentes, rolagens, notas, diários, missões, facções, áudio e permissões por recurso. Notas privadas e camadas do mestre ficarão isoladas por políticas e/ou entidades próprias; não serão carregadas para filtrar no navegador do jogador. Dados oficiais de rolagem serão produzidos por operações no servidor.

## Atualização e concorrência

Realtime transmite notificações de alteração no banco, filtradas pelas políticas de leitura. O cliente invalida consultas em lote com atraso de 150 ms; não transmite estados completos. Ao reconectar, subscrever, recuperar foco e periodicamente, consulta novamente a fonte de verdade. Mutações não são repetidas automaticamente para evitar duplicar operações.

Eventos DELETE possuem limitações de autorização de payload: o cliente não usa o payload como dado de autoridade. A remoção de acesso tem efeito imediato no banco, enquanto dados anteriormente carregados podem permanecer visíveis até a próxima consulta (até 30 segundos na tela de campanha ou 60 segundos nas demais). Dados já vistos por alguém não podem ser revogados da memória dessa pessoa. Segredos futuros exigirão consultas segregadas desde o início.

Edição de nome/descrição utiliza a última escrita confirmada no PostgreSQL nesta primeira fase; não há edição colaborativa de texto nem controle otimista de versão. Operações de membership/convite são transacionais. A sincronização incremental de tokens/desenhos exigirá identificadores e políticas próprias na Fase 2.

## Confiabilidade operacional

- Credenciais administrativas nunca ficam no frontend ou no Git. Erros públicos são traduzidos e não exibem detalhes internos do PostgreSQL.
- Avatar aceita somente HTTPS e limita comprimento; pode usar provedor externo, explicitado na interface. Uploads e Storage ainda não estão habilitados.
- Usuário precisa permanecer autenticado. Sessão é armazenada e renovada pelo Supabase Auth; logout limpa o cache de dados da aplicação.
- Acesso por usuário e senha sem e-mail ou PKCE. O servidor usa identificadores internos para integrar o Supabase Auth. Veja `ACESSO-POR-USUARIO.md` para os limites e a conversão das contas antigas.
- Logs registram alterações importantes, sem senhas, tokens ou conteúdo de notas privadas. A exclusão de campanha remove também seus logs; não são trilha de auditoria imutável externa.
- Antes de uso real, configure backup do projeto Supabase e documente uma restauração em ambiente separado. As migrations reproduzem a estrutura, não substituem backup de dados. Verifique retenção e recursos disponíveis no plano contratado.
- O endpoint de acesso aplica limites persistentes no banco, além das proteções do Auth. Convites são exibidos dentro do aplicativo; não há envio de e-mail.

## Referências consultadas

- [Supabase: RLS](https://supabase.com/docs/guides/database/postgres/row-level-security)
- [Supabase: autenticação por senha e recuperação](https://supabase.com/docs/guides/auth/passwords)
- [Vite: configuração inicial](https://vite.dev/guide/)
- [Tailwind: integração com Vite](https://tailwindcss.com/docs/installation/using-vite)
