# Plano de implementação

## Inspeção inicial — 9 de novembro de 2026

Repositório remoto vazio, sem commits ou arquivos, clonado na pasta fornecida. Nenhuma implementação anterior foi sobrescrita. Stack: React + TypeScript + Vite, React Router, Tailwind, Lucide, TanStack Query, Zustand e Supabase. Hospedagem inicial: ChatGPT Sites, conforme ajuste solicitado pelo usuário; Vercel fica preparada para depois. Sem Next.js. Todo código deve ser enviado ao GitHub.

## Entrega 1 — Fundação funcional

1. Design system grafite/âmbar, navegação responsiva e estados acessíveis.
2. Cliente Supabase tipado; configuração pública validada sem backend fictício.
3. Cadastro, confirmação por e-mail, login, recuperação de senha e logout.
4. Perfil, avatar por URL HTTPS e preferências persistidas no banco.
5. Criar, consultar, editar, arquivar, reativar e excluir campanhas.
6. Membros, convites vinculados ao e-mail, aceite/recusa/revogação e permissões de participante.
7. Migrations, RLS, operações atômicas no PostgreSQL, atualização de dados por Realtime e logs.
8. Testes de interface/domínio, testes SQL de isolamento e fluxos E2E; build de produção.

## Próximas entregas (escopo preservado)

- **2 — Mesa:** PixiJS, viewport, grid, cenas/mapas, camadas, tokens, desenhos colaborativos e sincronização incremental. Evoluir permissões por recurso.
- **3 — RPG:** rolagens oficiais no servidor, fichas D&D 2024, inventários, magias, iniciativa, condições e controle de fala.
- **4 — Mestre:** NPCs, monstros, encontros, missões, facções, diário, notas privadas/compartilhadas, sessões e preparação de cenas.
- **5 — Imersão:** uploads validados, biblioteca de áudio local e sincronizado explicitamente diferenciados, playlists e efeitos.
- **6 — Estabilização:** concorrência, reconexão, desempenho da mesa, acessibilidade, mobile, backup/restauração e revisão de segurança.

Não antecipar iluminação dinâmica. Não apresentar funções futuras como prontas. Não carregar dados de campanhas fictícias.

## Dependências externas

Projeto Supabase, URL pública e chave publicável, migrations aplicadas, configuração de confirmação e recuperação de e-mail, SMTP para produção e URLs de redirecionamento. Para publicação: projeto Vercel e as mesmas variáveis públicas. Nenhuma credencial administrativa é necessária no navegador. Validação integrada de autenticação e Realtime exige um projeto configurado ou Supabase CLI + Docker locais.
