# Pequenas Campanhas

Plataforma de RPG de mesa virtual em React, TypeScript e Vite. Desenvolvimento por fases, começando por contas, campanhas e permissões. O projeto não contém campanhas, usuários ou persistência fictícios. Backend conectado ao projeto Supabase `hpniaafplkaytvszcmde`, na organização Kbum, região São Paulo.

**Hospedagem atual: ChatGPT Sites.** O código completo fica neste repositório. A configuração da Vercel foi mantida para uma migração posterior, conforme solicitado. A mesa PixiJS e os sistemas de RPG são entregas seguintes; consulte [o plano](docs/PLANO.md).

## Estado da primeira entrega

- Design system grafite/âmbar, layout desktop e navegação adaptada para celular.
- Cadastro com confirmação de e-mail, login, recuperação de senha por PKCE, nova senha e logout da sessão atual.
- Perfil com nome, avatar por URL HTTPS e preferência de densidade persistida.
- Criação atômica de campanha e mestre; listagem, busca, edição, arquivamento, reativação e exclusão com confirmação pelo nome.
- Convites por e-mail de identidade, validade de sete dias, aceite, recusa e revogação. **Não há envio automático do convite por e-mail**: ele aparece na conta convidada e o mestre compartilha o link.
- Participantes, remoção, saída voluntária, permissões de desenho e movimentação de próprios tokens armazenadas para a Fase 2.
- RLS, RPCs com autorização no servidor, histórico de atividades e invalidação de consultas por Supabase Realtime.
- Sem Supabase configurado, a aplicação exibe uma tela de configuração; nenhuma operação é apresentada como salva.

**Backend conectado:** projeto criado, migrations aplicadas, RLS e publicação Realtime verificadas. O Site agora abre o login por senha. A confirmação de e-mail permanece habilitada; a configuração de retornos de confirmação/recuperação e SMTP foi adiada pelo usuário para priorizar o tabletop. Esses fluxos de e-mail ainda não foram validados. Detalhes em [conexão do Supabase](docs/CONEXAO-SUPABASE.md).

## Executar localmente

Requisitos: Node.js 22.12+ (Node 24 recomendado), pnpm 11.25 e Git. Se usar Corepack, habilite-o e respeite o `packageManager` do projeto.

```sh
pnpm install --frozen-lockfile
pnpm dev
```

O clone já utiliza a conexão pública em `src/lib/deployment.ts`, sem credenciais administrativas. Para usar outro backend, copie `.env.example` para `.env.local` (PowerShell: `Copy-Item .env.example .env.local`) e preencha:

```dotenv
VITE_SUPABASE_URL=https://SEU_PROJETO.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=SUA_CHAVE_PUBLICAVEL
```

A chave publicável `sb_publishable_…` ou a chave legada `anon` é destinada ao navegador. Nunca configure `service_role`, `sb_secret_…`, senha de banco ou token administrativo em variáveis `VITE_`. O cliente rejeita os formatos administrativos conhecidos. Não adicione `.env.local` ao Git.

O servidor abre em `http://127.0.0.1:5173`. Sem configuração, a tela inicial mostra os passos necessários. Reinicie o Vite depois de alterar variáveis.

## Configurar o Supabase

O projeto hospedado atual já foi criado e migrado. Para uma instância nova:

1. Crie um projeto Supabase.
2. Aplique **uma única vez**, na ordem, os arquivos de `supabase/migrations` pelo SQL Editor, ou use a CLI:

   ```sh
   supabase login
   supabase link --project-ref SEU_PROJECT_REF
   supabase db push --remote=SEU_PROJECT_REF
   ```

3. Em Auth, habilite e-mail/senha, confirmação de e-mail e senha mínima de 12 caracteres. Configure SMTP próprio antes de liberar para usuários reais.
4. Configure a Site URL para a origem da publicação. Na allowlist de redirecionamentos, inclua exatamente:

   ```text
   http://127.0.0.1:5173/auth/callback
   http://127.0.0.1:5173/auth/nova-senha
   https://pequenas-campanhas.ripplingantelope.chatgpt.site/auth/callback
   https://pequenas-campanhas.ripplingantelope.chatgpt.site/auth/nova-senha
   ```

   Links PKCE devem ser abertos no navegador que iniciou cadastro/recuperação. Não use curingas amplos em produção. A publicação privada do Sites também exige acesso do dono do Site; mantenha esse acesso até uma decisão explícita sobre disponibilização ao grupo.
5. Preencha as duas variáveis públicas, gere um novo build e publique. As tabelas desta fase são adicionadas à publicação `supabase_realtime` pela migration.

Para desenvolvimento Supabase local, instale a CLI e Docker, execute `supabase start` e `supabase db reset`. Use a URL e a chave **anon/publicável** da instância local. As mensagens de confirmação podem ser inspecionadas no serviço local de e-mail, porta 54324. `db reset` apaga os dados da instância local; não execute contra um ambiente com dados que precise preservar.

Ao alterar o schema, versione uma nova migration e regenere os tipos:

```sh
supabase gen types typescript --linked > src/types/database.ts
```

Os aliases de domínio atuais no mesmo arquivo devem ser preservados ou movidos para um arquivo separado antes de substituir o contrato gerado.

## Testes e build

```sh
pnpm typecheck
pnpm test
pnpm test:db
pnpm build
pnpm exec playwright install chromium
pnpm test:e2e
```

`pnpm test` inclui testes React Testing Library, validação e a migration real executada em PostgreSQL embarcado (PGlite), com papéis distintos, RLS e RPCs. Isso não substitui testes de integração dos serviços gerenciados do Supabase. `pnpm test:db` executa apenas a suíte de banco.

Os testes E2E servem o último `dist` com `vite preview`: **rode o build antes**. Eles verificam o login, proteção de rotas profundas, ausência de erros JavaScript e largura mobile, sem criar contas nem enviar e-mails. Para usar o Edge instalado em vez de baixar Chromium, defina `PLAYWRIGHT_CHANNEL=msedge` no terminal. No PowerShell: `$env:PLAYWRIGHT_CHANNEL = 'msedge'`.

`supabase/checks/hosted_smoke.sql` também passou no banco hospedado, validando operações e isolamento de papéis em uma transação revertida. Nenhum usuário ou campanha de teste permaneceu no banco. A CLI Supabase v3 usa alvo local por padrão: declare `--remote=PROJECT_REF` nas operações remotas e revise o diff.

Com Supabase CLI + Docker, `pnpm test:supabase` também executa os testes pgTAP em `supabase/tests`. A CI instala dependências, testa, compila e executa Playwright.

## Publicação no ChatGPT Sites

O Site está vinculado pelo identificador opaco em `.openai/hosting.json`, com build estático em `dist`. Preserve esse identificador nas próximas atualizações. O fluxo de publicação usa as ferramentas do plugin Sites para sincronizar o mesmo commit, empacotar `dist`, salvar uma versão e publicá-la. Tokens temporários de sincronização nunca devem ser adicionados ao repositório.

As variáveis `VITE_` são substituídas **durante o build**. Variáveis de runtime do Sites, por si só, não reconfiguram um bundle estático já compilado. Para conectar o Supabase depois, configure as variáveis no ambiente de build, compile novamente e publique uma nova versão.

O repositório GitHub é a fonte de trabalho e deve receber todas as alterações. A cópia de fonte exigida pelo Sites é sincronizada a partir do mesmo checkout, sem substituir `origin` e sem guardar credenciais no Git. Nenhuma publicação na Vercel é necessária nesta etapa.

## Vercel — migração posterior

Quando solicitada, importe este repositório na Vercel como projeto Vite, use `pnpm build`, saída `dist` e as duas variáveis públicas acima. `vercel.json` já inclui reescrita SPA e cabeçalhos básicos. Adicione a nova origem às URLs autorizadas do Supabase e gere o build novamente.

## Organização

```text
src/app/                  roteamento, providers, páginas principais e tokens visuais
src/components/           layout e componentes acessíveis reutilizáveis
src/modules/auth/         autenticação, confirmação e recuperação
src/modules/campaigns/    domínio de campanhas, acesso a dados, telas e participantes
src/modules/profile/      edição do perfil
src/lib/                  configuração, cliente, erros e validação
src/stores/               estado de interface em Zustand
src/types/                contrato do banco e tipos do domínio
supabase/migrations/      estrutura, RLS, funções e publicação Realtime
supabase/tests/           testes para PostgreSQL/Supabase local
e2e/                      testes desktop/mobile
docs/                     decisões, segurança, plano e relatório da entrega
```

Consulte [arquitetura e segurança](docs/ARQUITETURA.md), [relatório da entrega](docs/ENTREGA-01.md) e [plano completo](docs/PLANO.md).
