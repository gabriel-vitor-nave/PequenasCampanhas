# Pequenas Campanhas

Tabletop em React, TypeScript, Vite e PixiJS, com Supabase Auth, PostgreSQL, Storage e Realtime. Backend na organização Kbum, região São Paulo. Login exclusivamente por **usuário e senha**, preservando contas e campanhas existentes.

**Publicação: ChatGPT Sites. Fonte: este GitHub.** Vercel fica para uma migração posterior. As [diretrizes](docs/DIRETRIZES.md) definem o projeto; veja também [arquitetura e aceitação da mesa](docs/MESA-JOGAVEL.md).

## Usar a mesa

Abra uma campanha e clique em **Abrir mesa**. O mestre envia o mapa e configura o grid em **Mapa e grid**. Em **Tokens**, crie o token, ajuste imagem, tamanho e vida, e marque seus controladores em **Quem pode mover**. As permissões gerais de desenho e movimentação ficam em **Campanha → Participantes**.

- Mapas JPG/PNG/WebP, posição, tamanho, substituição, bloqueio e grid quadrado/hexagonal com alinhamento, escala, cor e opacidade.
- Câmera individual com zoom/pan. Publicar uma cena leva os jogadores à cena ativa.
- Tokens com controle compartilhado, seleção múltipla, snap, copiar/colar/duplicar, sobreposição, visibilidade, CA, PV, condições e concentração.
- Lápis, linha, retângulo, círculo, seta, texto, borracha e movimentação de desenhos. Desfazer/refazer durante a sessão e camada privada do mestre filtrada no servidor.
- Dados oficiais no PostgreSQL: d4/d6/d8/d10/d12/d20/d100, modificadores, kh/kl, vantagem/desvantagem, histórico público e rolagens privadas.
- Iniciativa, turnos, rodadas, dano/cura e PV temporários em painel lateral.
- Músicas/SFX enviados pelo mestre, posição sincronizada, loop, volumes principal/individual e efeitos locais. Cada navegador precisa **Ativar áudio**. Voz continua no Discord.
- Realtime, presença, pings, reconciliação após reconexão e revisão de recursos para detectar edições concorrentes.
- Exportação JSON das cenas, tokens, desenhos, participantes, configuração e últimas 80 rolagens. Inclui metadados dos arquivos, sem incorporar binários. Ainda não há importação/restauração.

Atalhos: **V** selecionar, **H** câmera, **P** lápis, **L** linha, **R** retângulo, **O** círculo, **A** seta, **T** texto, **E** borracha. **Espaço + arrastar** ou botão do meio move a câmera; roda ajusta zoom; **Alt + clique** envia ping. **Shift + clique** seleciona vários tokens; setas movem os autorizados. **Ctrl+C/V**, Delete e **Ctrl+Z/Y** operam sobre os recursos selecionados/desenhos.

Imagens: até 10 MB; upload de mapa aceita até 8192 px por lado. Áudios: até 25 MB, MP3/WAV/OGG/WebM/M4A; decodificação depende dos codecs do navegador. Fichas completas D&D 2024, régua, templates, névoa, auras, diário/NPCs e playlists avançadas pertencem às próximas entregas. Não há controles decorativos para elas.

## Desenvolvimento local

Node.js 22.12+ (24 recomendado), pnpm 11.25 e Git:

```sh
pnpm install --frozen-lockfile
pnpm dev
```

O clone usa a configuração pública em `src/lib/deployment.ts`. Para outro backend, copie `.env.example` para `.env.local` e preencha `VITE_SUPABASE_URL` e `VITE_SUPABASE_PUBLISHABLE_KEY`. Nunca use chaves administrativas em variáveis `VITE_`. Arquivos `.env*`, `.tmp` e credenciais locais não entram no Git.

## Backend

As migrations em `supabase/migrations` versionam campanhas, permissões, autenticação e mesa. Não use `db reset` em um banco com dados a preservar. As funções `account-access` e `table-assets` estão publicadas no projeto `hpniaafplkaytvszcmde`.

- `account-access` recebe usuário/senha, verifica limites de tentativas e autentica no Supabase Auth. Um identificador interno não entregável mantém compatibilidade com o Auth, sem pedir contato ou confirmação. Contas antigas migram somente após comprovação da senha atual. Não há recuperação automática por nome de usuário. Veja [acesso por usuário](docs/ACESSO-POR-USUARIO.md).
- `table-assets` verifica o Bearer em Auth `/user` e exige papel de mestre para upload/exclusão. Inspeciona assinatura e tamanho de arquivos. O bucket é privado; URLs assinadas dependem dos recursos visíveis ao participante. A exclusão confirmada da campanha remove seus arquivos antes dos metadados, preservando a campanha para nova tentativa se a limpeza falhar.
- Ambas usam `verify_jwt=false` intencionalmente: a primeira autentica credenciais; a segunda faz sua própria verificação explícita do token. Isso não dispensa autenticação nos handlers. Chaves administrativas ficam somente no runtime seguro das funções.
- RLS filtra campanhas, cenas, tokens, desenhos, arquivos e rolagens privadas antes de responder ao navegador. Resultados de dados são sorteados e persistidos no servidor. Movimentos e comandos oficiais têm ID de requisição e proteção contra repetição.
- A revisão de campanha também é atualizada ao ocultar ou excluir recursos, permitindo invalidar o estado sem transmitir conteúdo privado por broadcast.

Para outra instância, aplique migrations em ordem, publique as duas funções com suas dependências e ajuste a configuração pública e as origens CORS. O runtime hospedado fornece as variáveis administrativas. Na CLI Supabase v3, declare `--remote=PROJECT_REF` nas operações remotas e revise o diff.

## Verificação

```sh
pnpm test
pnpm build
pnpm test:e2e
```

Os testes incluem React Testing Library, geometria, validação de uploads e migrations reais em PostgreSQL embarcado (PGlite), com RLS/RPCs e diferentes papéis. Com CLI e Docker, `pnpm test:supabase` também executa pgTAP. A CI testa, compila e executa Playwright.

E2E serve o último `dist`: **rode o build antes**. A execução padrão verifica login, proteção de rotas e layout sem criar contas. Para usar Edge instalado, defina `PLAYWRIGHT_CHANNEL=msedge`.

O teste `e2e/tabletop.spec.ts` exige `E2E_TABLE_LIVE=1` e roda no projeto desktop contra o backend real, com dois contextos, contas temporárias, arquivos reais e Realtime. Traces ficam desligados para não gravar credenciais. O fixture fica em `.tmp/table-acceptance.local`, ignorado pelo Git. No sucesso, campanha e arquivos são removidos. Em falha, a próxima execução reutiliza as contas e limpa a campanha anterior. Remova as contas temporárias por operação administrativa autenticada após validar; nunca use contas reais neste cenário. `E2E_LIVE_ACCOUNTS=1` habilita separadamente o teste opcional de cadastro/login.

## Publicação

`.openai/hosting.json` mantém o identificador do Site e a saída estática `dist`. O fluxo sincroniza o mesmo commit com GitHub e a fonte do Sites, empacota `dist`, salva versão e publica. Tokens temporários não são persistidos no Git. As variáveis `VITE_` são substituídas durante o build; variáveis de runtime não alteram um bundle já compilado.

`vercel.json` foi mantido para migração futura. Não há publicação na Vercel nesta etapa.
