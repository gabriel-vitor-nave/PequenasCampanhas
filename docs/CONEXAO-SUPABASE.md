# Backend conectado — 9 de novembro de 2026

## Recursos aplicados

- Organização selecionada pelo usuário: **Kbum**.
- Projeto: **Pequenas Campanhas** (`hpniaafplkaytvszcmde`).
- Região: São Paulo (`sa-east-1`); cotação retornada na criação: US$ 0/mês.
- URL: `https://hpniaafplkaytvszcmde.supabase.co`.
- URL e chave **publicável** em `src/lib/deployment.ts`, com overrides `VITE_SUPABASE_*` opcionais. Nenhum segredo administrativo no Git.
- Migrations locais alinhadas às versões registradas no Supabase: `20261109234648_foundation` e `20261109235328_backend_hardening`.
- Cinco tabelas com RLS; quatro inscritas em `supabase_realtime`.
- Implementações privilegiadas no schema `private`; entrada pública com `SECURITY INVOKER`. Índices adicionados às três FKs apontadas pela revisão.
- Revisão de segurança Supabase após os ajustes: nenhum alerta.

## Verificação

`supabase/checks/hosted_smoke.sql` passou no PostgreSQL hospedado, com usuários temporários e rollback integral. Verificou criação atômica de campanha/mestre, roster, destinatário de convite, aceite, impedimento de repetição, bloqueio de edição e promoção por jogador, permissões e revogação de acesso ao remover jogador.

Após o teste: zero usuários e zero campanhas persistidos. A API de configurações Auth retornou HTTP 200, cadastro e e-mail habilitados e confirmação exigida. Leitura anônima das campanhas retornou HTTP 401. Nenhum e-mail real ou senha de teste foi utilizado.

Também passaram os 20 testes locais e os quatro testes de navegador atualizados para a aplicação conectada (desktop/mobile). O build de produção foi gerado com TypeScript estrito.

## Login e pendências de e-mail

O login usa e-mail e senha do Supabase. O usuário decidiu adiar a autorização adicional da CLI e priorizar o tabletop. Não foram aplicadas ao Auth hospedado a Site URL e a allowlist de retornos de e-mail. Os valores desejados estão versionados em `supabase/config.toml`; esse arquivo, por si só, não altera o provedor.

Não foi desabilitada a confirmação de e-mail nem flexibilizada a identidade usada nos convites. Cadastros novos ainda dependem da confirmação do provedor. Retornos de confirmação/recuperação e SMTP precisam de ajuste antes de considerar esses fluxos prontos para o grupo; não foram validados de ponta a ponta.

O acesso visual ao painel foi interrompido pela ferramenta por não conseguir verificar a URL atual do Chrome. A integração conectada não oferece edição de Auth config. A autorização oficial da CLI foi cancelada antes de receber código, após o usuário optar por adiar essa etapa. Nenhum token administrativo foi fornecido ao projeto.

Quando essa configuração for retomada por uma sessão autorizada, use os comandos descobertos na CLI v3:

```sh
supabase config diff --remote=hpniaafplkaytvszcmde
supabase config push --remote=hpniaafplkaytvszcmde
```

Inspecione o diff e preserve confirmação de e-mail. Não envie tokens ao chat nem ao repositório.

## Próximo foco

Mesa virtual com viewport PixiJS, grid, cenas, mapas, tokens e desenho persistido e autorizado por recurso. O backend conectado será utilizado pelas próximas migrations.
