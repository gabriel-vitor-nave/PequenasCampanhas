# Pequenas Campanhas

Plataforma de RPG de mesa virtual em React, TypeScript e Vite. Desenvolvimento por fases, começando por contas, campanhas e permissões. O projeto não contém campanhas, usuários ou persistência fictícios. Backend conectado ao projeto Supabase `hpniaafplkaytvszcmde`, na organização Kbum, região São Paulo.

**Hospedagem atual: ChatGPT Sites.** O código completo fica neste repositório. A configuração da Vercel foi mantida para uma migração posterior, conforme solicitado. A mesa PixiJS e os sistemas de RPG são entregas seguintes; consulte [o plano](docs/PLANO.md).

## Estado da primeira entrega

- Design system grafite/âmbar, layout desktop e navegação adaptada para celular.
- Cadastro e login com somente usuário e senha, entrada imediata e logout da sessão atual. Nenhum e-mail, código ou confirmação.
- Perfil com nome, avatar por URL HTTPS e preferência de densidade persistida.
- Criação atômica de campanha e mestre; listagem, busca, edição, arquivamento, reativação e exclusão com confirmação pelo nome.
- Convites por nome de usuário, validade de sete dias, aceite, recusa e revogação. O destinatário fica vinculado ao ID da conta.
- Participantes, remoção, saída voluntária, permissões de desenho e movimentação de próprios tokens armazenadas para a Fase 2.
- RLS, RPCs com autorização no servidor, histórico de atividades e invalidação de consultas por Supabase Realtime.
- Sem Supabase configurado, a aplicação exibe uma tela de configuração; nenhuma operação é apresentada como salva.

**Backend conectado:** banco, RLS, Realtime e função de acesso publicados. O acesso pede somente usuário e senha. A conta existente conserva sua senha e usa o nome de usuário derivado do perfil. Consulte [acesso por usuário](docs/ACESSO-POR-USUARIO.md).

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

## Configurar outra instância Supabase

O projeto atual já está configurado. Para outra instância, aplique as migrations em ordem e publique a função `supabase/functions/account-access` com seus arquivos compartilhados. O banco usa RLS e a função autentica a senha no Supabase Auth. As credenciais administrativas ficam somente no ambiente seguro da função, nunca no frontend.

```sh
supabase login
supabase link --project-ref SEU_PROJECT_REF
supabase db push --remote=SEU_PROJECT_REF
supabase functions deploy account-access --remote=SEU_PROJECT_REF --use-api
```

Atualize a URL e a chave publicável em `src/lib/deployment.ts` e republique também a função, que usa essa mesma chave para validar as chamadas do aplicativo. Atualize as origens autorizadas no handler ao mudar de domínio. O runtime hospedado fornece `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` e `SUPABASE_ANON_KEY` automaticamente.

A função é uma entrada pública de credenciais: `verify_jwt=false` é intencional porque o usuário ainda está entrando. O handler verifica a chave do aplicativo, valida a senha, limita tentativas no banco e nunca devolve a chave administrativa. A Data API continua exigindo JWT e RLS.

Não há SMTP, callback ou confirmação de e-mail a configurar para este fluxo. Um identificador interno não entregável mantém a compatibilidade com o Auth; ele não é exibido nem solicitado ao usuário. Senhas ficam sob hashing do Supabase Auth.

Não há recuperação automática de senha nesta etapa. Contas antigas são convertidas depois da comprovação da senha atual; o ID, a senha e as participações são preservados. Não crie processos de redefinição baseados apenas em conhecer o nome de usuário.

Para desenvolvimento local com Supabase CLI e Docker, use `supabase start`. Não use `db reset` em um ambiente com dados que precise preservar. Na CLI v3, indique `--remote=PROJECT_REF` quando a operação for remota. Versione novas migrations e preserve os aliases de domínio ao regenerar os tipos TypeScript.

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

Os testes E2E servem o último `dist` com `vite preview`: **rode o build antes**. Eles verificam o login, proteção de rotas profundas, ausência de erros JavaScript e largura mobile, sem criar contas na execução padrão. Para uma verificação completa contra o backend hospedado, use `E2E_LIVE_ACCOUNTS=1`: ela cria uma conta explicitamente descartável, que precisa ser removida após o teste. Nenhum e-mail é enviado. Para usar o Edge instalado em vez de baixar Chromium, defina `PLAYWRIGHT_CHANNEL=msedge` no terminal. No PowerShell: `$env:PLAYWRIGHT_CHANNEL = 'msedge'`.

`supabase/checks/hosted_smoke.sql` também passou no banco hospedado, validando operações e isolamento de papéis em uma transação revertida. Nenhum usuário ou campanha de teste permaneceu no banco. A CLI Supabase v3 usa alvo local por padrão: declare `--remote=PROJECT_REF` nas operações remotas e revise o diff.

Com Supabase CLI + Docker, `pnpm test:supabase` também executa os testes pgTAP em `supabase/tests`. A CI instala dependências, testa, compila e executa Playwright.

## Publicação no ChatGPT Sites

O Site está vinculado pelo identificador opaco em `.openai/hosting.json`, com build estático em `dist`. Preserve esse identificador nas próximas atualizações. O fluxo de publicação usa as ferramentas do plugin Sites para sincronizar o mesmo commit, empacotar `dist`, salvar uma versão e publicá-la. Tokens temporários de sincronização nunca devem ser adicionados ao repositório.

As variáveis `VITE_` são substituídas **durante o build**. Variáveis de runtime do Sites, por si só, não reconfiguram um bundle estático já compilado. Para conectar o Supabase depois, configure as variáveis no ambiente de build, compile novamente e publique uma nova versão.

O repositório GitHub é a fonte de trabalho e deve receber todas as alterações. A cópia de fonte exigida pelo Sites é sincronizada a partir do mesmo checkout, sem substituir `origin` e sem guardar credenciais no Git. Nenhuma publicação na Vercel é necessária nesta etapa.

## Vercel — migração posterior

Quando solicitada, importe este repositório na Vercel como projeto Vite, use `pnpm build`, saída `dist` e as duas variáveis públicas acima. `vercel.json` já inclui reescrita SPA e cabeçalhos básicos. Adicione a nova origem à allowlist de CORS da função de acesso e gere o build novamente.

## Organização

```text
src/app/                  roteamento, providers, páginas principais e tokens visuais
src/components/           layout e componentes acessíveis reutilizáveis
src/modules/auth/         acesso por usuário e senha
src/modules/campaigns/    domínio de campanhas, acesso a dados, telas e participantes
src/modules/profile/      edição do perfil
src/lib/                  configuração, cliente, erros e validação
src/stores/               estado de interface em Zustand
src/types/                contrato do banco e tipos do domínio
supabase/migrations/      estrutura, RLS, funções e publicação Realtime
supabase/tests/           testes para PostgreSQL/Supabase local
supabase/functions/       função segura de acesso e limites de tentativas
shared/                   validação compartilhada entre frontend e servidor
e2e/                      testes desktop/mobile
docs/                     decisões, segurança, plano e relatório da entrega
```

Consulte [arquitetura e segurança](docs/ARQUITETURA.md), [relatório da entrega](docs/ENTREGA-01.md) e [plano completo](docs/PLANO.md).
