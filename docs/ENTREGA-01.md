# Entrega 01 — Fundação

Data: 9 de novembro de 2026.

## Implementado

Fundação React/Vite/TypeScript, design system grafite/âmbar, navegação responsiva e tratamento de estados. Integração Supabase preparada para cadastro, confirmação de e-mail, login, recuperação e logout. Perfis e preferências persistentes. Campanhas com criação atômica, busca, consulta, edição, arquivamento, reativação e exclusão confirmada. Convites vinculados ao e-mail, aceite/recusa/revogação, gerenciamento de jogadores e permissões iniciais. Eventos de atividade, políticas RLS e atualização de consultas por Realtime.

Sem credenciais válidas, a aplicação abre uma tela de configuração. Biblioteca e mesa virtual indicam explicitamente a fase futura. Não há dados fictícios no produto nem operações que aleguem persistência sem backend.

## Arquivos criados e modificados

Repositório originalmente vazio: todos os arquivos desta entrega foram criados, sem substituição de implementação anterior.

- Raiz: `package.json`, lockfile, workspace pnpm, TypeScript, Vite/Vitest, Playwright, `.gitignore`, `.env.example`, `index.html`, `vercel.json`, README.
- `src/app`: bootstrap/rotas, configuração inicial, início, biblioteca, configurações e estilos.
- `src/components`: layout, marca e componentes de interface.
- `src/modules`: autenticação, recuperação, campanhas, participantes, convites, perfil e serviços.
- `src/lib`, `src/types`, `src/stores`: configuração segura, cliente tipado, validação, erros, contrato do banco e estado de interface.
- `supabase`: configuração local, migration da fundação e testes pgTAP.
- `e2e`: testes desktop e mobile; `.github/workflows`: verificação automática.
- `.openai/hosting.json`: identidade do ChatGPT Site e saída estática `dist`.
- `docs`: plano, arquitetura/segurança e este relatório.

## Decisões

O PostgreSQL é a fonte de verdade. Dados remotos ficam no TanStack Query, e Zustand guarda somente estado efêmero. Privilegiar RPCs transacionais para convites/membros evita operações parcialmente salvas e permite autorização independente do cliente. Permissões de mestre não são derivadas de metadata editável do usuário. Recursos futuros não foram mascarados como funcionais.

Hospedagem inicial alterada para **ChatGPT Sites** por instrução do usuário. Preservada a configuração Vercel para depois. O checkout conserva o GitHub como `origin`; a publicação do Sites sincroniza a mesma fonte para o repositório gerenciado pela ferramenta.

## Validação

- Build de produção passou, com verificação TypeScript estrita. Bundle separado para o cliente Supabase.
- **20 testes passaram:** validação/configuração, formulários de autenticação e 12 casos no PostgreSQL real embarcado (PGlite), executando a migration, papéis e RLS.
- **4 testes Playwright passaram** em Edge headless, desktop e viewport de celular: tela de configuração, rota profunda, ausência de erros JavaScript e ausência de overflow horizontal.
- Testes pgTAP incluídos para Supabase local; exigem CLI + Docker e ainda não foram executados nesse ambiente.
- Não foi validada entrega de e-mails, autenticação real remota, Realtime entre dois usuários ou reconexão ao serviço hospedado: faltam as credenciais do projeto Supabase.

## Problemas encontrados e resolvidos

- Pasta e remoto vazios: criado o checkout e a estrutura modular.
- `npm` não estava no PATH: utilizado pnpm disponível, com versão declarada no projeto.
- Uma versão intermediária depreciada de `jest-dom` foi resolvida pelo range: fixada em 6.9.1 e adicionada sua dependência de DOM.
- Aprovação de script de build do esbuild exigida pelo pnpm: permitido somente esse pacote em `pnpm-workspace.yaml`.
- Restrição de renomeação de arquivos temporários impediu o primeiro Vitest: suíte executada fora dessa restrição e passou.
- Primeira tentativa de navegador excedeu o tempo servindo transformações do Vite: testes passaram ao servir o build compilado, com dois workers.

## Dependências pendentes

Projeto Supabase com migration aplicada, URL e chave pública, confirmação/recuperação de e-mail e SMTP de produção. Sem isso a publicação mostra a configuração inicial. Acessibilidade completa, testes com serviços hospedados e revisão operacional para liberar ao grupo fazem parte da estabilização contínua; a entrega ainda não é a plataforma completa.

## Próximas tarefas

Conectar o Supabase e validar os fluxos entre mestre e jogador em duas sessões reais. Depois iniciar a Fase 2: viewport PixiJS, grid, cenas, mapas, camadas, tokens e desenhos com persistência e autorização por objeto. Preservar as fases 3–6 do plano.
