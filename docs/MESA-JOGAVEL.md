# Mesa jogável — plano e contrato da entrega

Diretrizes recebidas em 9/11/2026 substituem a ordem anterior: desktop, grafite/cinza/azul, sem slogans. Preservar contas por usuário/senha, campanhas, GitHub e Sites.

## Recorte obrigatório desta entrega

Abrir mesa na campanha; cenas, upload de mapa, grid quadrado/hexagonal configurável, câmera individual, tokens autorizados, desenhos compartilhados e privados, dados oficiais no servidor, iniciativa/PV, música e SFX. Tudo persistido e atualizado entre duas sessões reais. Não publicar controles para ferramentas ainda não implementadas.

## Arquitetura

- `modules/table`: domínio, serviços, renderizador PixiJS, controles e painéis compactos. A mesa tem rota própria sem a navegação lateral geral.
- Câmera, seleção, ferramentas e volume individual são locais; mapa, tokens, desenhos, combate, rolagens e comandos de áudio ficam no PostgreSQL.
- Cada desenho/token é um recurso separado. Cenas e recursos privados são filtrados por RLS antes de chegar ao cliente.
- Movimento e ações oficiais usam RPCs autorizadas, revisão de recurso e IDs de requisição. Dados são sorteados e registrados no PostgreSQL, nunca aceitos do cliente.
- Arquivos em bucket privado, upload autenticado de mestre com validação de conteúdo e tamanho no servidor; URLs assinadas respeitam os recursos visíveis.
- Realtime invalida consultas por campanha e recupera o estado após reconexão. Canal privado para presença e pings, sem usar mensagens de cliente como autorização.
- Áudio sincroniza comando, posição e tempo do servidor. Ativação de áudio no navegador e volume individual são explícitos.

## Verificação de conclusão

Dois usuários descartáveis, mestre/jogador, em contextos de navegador separados. Criar campanha, convidar jogador, abrir mesa, enviar mapa e áudio, criar token controlado pelo jogador, mover, desenhar, rolar, iniciar combate e emitir áudio. Verificar atualização do outro contexto e persistência após reload, além de negar acesso a terceiro usuário e a conteúdo privado. Remover somente os fixtures criados pelo teste.

Fichas completas, régua/templates, névoa, diário/NPCs, biblioteca avançada, automações e playlists avançadas permanecem nas entregas 2 e 3.

## Validação realizada — 9/11/2026

- 43 testes de unidade, interface e PostgreSQL/PGlite aprovados.
- Cinco verificações Playwright aprovadas: login e rotas protegidas em desktop/celular, mais a mesa em dois contextos de desktop. Três cenários opcionais fora desse recorte foram ignorados explicitamente.
- Cenário hospedado: mapa e grid, controlador de token, movimentação recebida pelo mestre em menos de 10 s, desenho do jogador, isolamento de cena/token/desenho privado, expressão 2d20kh1+5 com uma única rolagem persistente, iniciativa, combate, dano, upload de WAV, música nos dois navegadores com diferença inferior a 1,5 s, SFX compartilhado/local, parada e recarga com estado preservado.
- Nenhum erro JavaScript nos dois contextos. Capturas de mestre/jogador revisadas visualmente. Os arquivos usados são fixtures de teste, sem conteúdo de campanhas reais.
- Índices compostos adicionados após diagnóstico do Supabase. Sem pendências de FK sem índice. Tabelas privadas de rate limit e idempotência ficam propositalmente sem políticas para clientes. O aviso preexistente de proteção contra senhas vazadas depende das configurações do Auth: https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection.

## Limites deste recorte

Desfazer/refazer cobre desenhos nesta sessão do navegador, sem histórico global de edição. Exportação JSON contém as cenas e seus recursos e as últimas 80 rolagens; arquivos binários e restauração ficam para a etapa posterior. A câmera é individual e pings são efêmeros. Áudio exige ativação local; navegador/codec e latência limitam a precisão de reprodução. Não há promessa de sincronização de áudio em nível de amostra.

## Porte móvel e preparação solo — atualização posterior

A instrução posterior inclui celular, sempre em horizontal. A mesa gira sua própria área quando o aparelho está em pé, sem girar login/campanhas. Coordenadas de toque passam pela transformação inversa. Pinça move/amplia a câmera e cancela operações de desenho/arraste pendentes; um dedo move a câmera no espaço vazio e arrasta tokens autorizados. Toque prolongado abre menus sem disparar uma ação ao soltar o dedo. Controles por toque evitam cliques de compatibilidade duplicados, inclusive quando fechar um painel muda o alvo sob o dedo.

Painéis sobrepostos/recolhíveis, alvos de 44 px, rolador recolhível, seleção múltipla, menus de copiar/colar, área segura do aparelho e ajuste ao teclado virtual. O áudio reutiliza elementos desbloqueados no toque e usa ganho Web Audio quando disponível, com até 16 canais de SFX.

O mestre prepara e salva mapas, grid, tokens, desenhos, rolagens, combate, música/SFX e cenas privadas/compartilhadas com zero jogadores na campanha e sem convites. Não há dependência de presença ou de início formal de sessão. O primeiro jogador pode entrar depois e recebe o estado persistido permitido.

Validação final: 50 testes unitários/interface/banco aprovados; regressão desktop com três verificações aprovadas, incluindo dois navegadores com música/SFX; aceitação móvel aprovada em Chromium e WebKit. O cenário móvel cria inicialmente só o mestre, verifica ausência de jogadores/convites, configura e recarrega a mesa e somente então cria/convida o jogador. Capturas de orientação, painéis, menus e rolador revisadas.

Limite de verificação: os navegadores móveis foram emulados. No Chromium, pinça e arraste usam eventos nativos de toque via CDP. No WebKit, esses gestos são enviados como Pointer Events sintéticos, enquanto os controles recebem toques do navegador. O WebKit instalado neste Windows não expõe AudioContext e devolveu NotSupportedError ao reproduzir WAV; nele foram validados interface e comandos persistidos, sem fingir reprodução. Reprodução/sincronização passou no Chromium. Áudio e teclado em Safari/iPhone físico ainda precisam de validação em aparelho real.
