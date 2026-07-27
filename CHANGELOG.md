# CHANGELOG

## 26.8.5 - 2026-07-27

Type: Feature

Description:
- Novo projeto agora solicita separadamente o nome da pasta e do repositório, cria `.npsharp/project.json`, inicializa Git quando disponível e mantém o projeto criado mesmo se `git init` falhar ou o Git não estiver instalado.

## 26.8.4 - 2026-07-27

Type: Fix

Description:
- Corrige a aplicação do tamanho de tabulação em modelos existentes e novos, troca os campos livres de fonte/tamanho/tabulação por menus de seleção, ativa a navegação voltar/avançar da barra superior e permite excluir a seleção da árvore pelo botão ou pelas teclas Delete/Backspace.

## 26.8.3 - 2026-07-27

Type: Fix

Description:
- No Linux, passa Vite, TypeScript e a observação dos artefatos Electron no modo de desenvolvimento para polling controlado, eliminando a dependência de inotify nesses processos e o erro `EMFILE` em limites baixos de descritores.

## 26.8.2 - 2026-07-27

Type: Fix

Description:
- Impede o Vite de observar artefatos de Android, builds e releases; no Linux, substitui o watcher recursivo do workspace por observação rasa e polling limitado para subpastas, reduzindo o consumo de inotify e descritores de arquivo.

## 26.8.1 - 2026-07-27

Type: Feature

Description:
- Adiciona o easter egg de criação explícita de arquivo: somente um novo `gta6.py` criado pelo Explorer do NPSharp recebe o conteúdo Python especial, por criação atômica e sem tocar em arquivos existentes ou detectados externamente.

## 26.8.0 - 2026-07-27

Type: Fix

Description:
- Adiciona abertura universal de arquivos: inspetor hexadecimal/ASCII para binários, visualizadores de mídia e PDF, índice de ZIP/JAR/APK/VSIX e leitura estruturada de NBT (inclusive comprimido). Arquivos desconhecidos deixam de abrir em um diálogo sem utilidade.

- Torna a barra de status útil: mostra branch Git, último autor do arquivo, linguagem, fim de linha, codificação e posição do cursor. A codificação pode ser alterada entre UTF-8 e UTF-8 com BOM diretamente pela barra e é preservada ao salvar.

- Unifica explicitamente a criação inline de arquivos e pastas no Explorer: ambos usam a mesma linha temporária, foco automático, Enter para criar e Esc para cancelar.

- Exibe o chat de IA em um painel ancorado à direita e abre a configuração da chave de API quando um provedor que exige credencial é usado sem chave configurada.

- Atualiza o decorador de cores hex para mostrar uma prévia quadrada e colorir o próprio valor hexadecimal, inclusive após editar o conteúdo.

- Adiciona Alt+Z para alternar a quebra automática de linhas, opções funcionais de tema/cor de ícones e integração com a Open VSX para pesquisar e instalar extensões pelo painel de Extensões.

- Foca imediatamente o input de criação no Explorer e adiciona exclusão funcional de arquivos e pastas, com confirmação configurável e opção persistente de não confirmar novamente.

- Exibe a criação de arquivo e pasta diretamente na árvore do Explorer, com linha temporária, input no local selecionado, Enter para confirmar e Esc para cancelar, no comportamento visual do VS Code.

- Substitui o diálogo nativo de criação do Explorador por uma janela interna com validação e erros visíveis; os botões e o menu de contexto agora usam o mesmo fluxo confiável para criar arquivos e pastas, inclusive caminhos aninhados.

- Carrega os estilos e a fonte dos Codicons do Monaco para exibir corretamente os ícones da pesquisa aberta por Ctrl+F/Cmd+F.
- Conclui a tradução para português do Brasil dos textos visíveis restantes em Controle de Código-Fonte, Host Remoto, Terminal, Runtimes, Extensões, menus e paleta de comandos.
- Carrega explicitamente a contribuição Find do Monaco e executa a ação `actions.find` na instância ativa para corrigir Ctrl+F/Cmd+F.
- Exibe Configurações em uma janela modal própria, organiza o painel de Problemas e permite criar arquivos e pastas aninhados pelo caminho relativo informado.
- Cria novos projetos em uma pasta escolhida, inicializa `.npsharp` e executa `git init` antes de abrir o workspace.

## 26.6.5 - 2026-07-27

Type: Fix

Description:
- Corrige a pesquisa rápida da barra superior para indexar e abrir arquivos reais do workspace, com filtro progressivo por nome ou caminho e exclusão de diretórios de dependências e build.
- Corrige a abertura da busca do Monaco no arquivo ativo e torna as operações da árvore de arquivos seguras, persistentes e sincronizadas com o filesystem.
- Traduz os menus principais, a barra de título e o painel de pesquisa para português do Brasil.

## 26.6.4 - 2026-07-25

Type: Feature

Description:
- Adiciona decoradores de cor hexadecimal no editor, exibindo um quadrado com a cor correspondente imediatamente antes de cada valor iniciado por #.

## 26.6.3 - 2026-07-25

Type: Fix

Description:
- Reduz a MiniMap para escala compacta, largura limitada e slider sob demanda, preservando a sincronizacao com o editor.
- Corrige a decodificacao incremental UTF-8 das saidas de processos e do fallback do terminal, evitando caracteres de substituicao quando bytes multibyte chegam em chunks separados.

## 26.6.2 - 2026-07-25

Type: Fix

Description:
- Reinicia automaticamente o processo Electron no modo de desenvolvimento quando os artefatos do main ou preload forem recompilados, mantendo os handlers IPC sincronizados com o renderer.

## 26.6.1 - 2026-07-25

Type: Fix

Description:
- Impede a abertura indevida do DevTools em execucoes normais da aplicacao.
- Habilita os Color Decorators nativos do Monaco e conclui a selecao contextual do Explorer para criar arquivos e pastas no item selecionado.

## 26.6.0 - 2026-07-25

Type: Feature

Description:
- Adiciona resolucao centralizada de arquivos por conteudo e extensao, evitando abrir imagens no Monaco e avisando antes de abrir binarios como texto.
- Adiciona Image Viewer em abas com zoom por roda/Ctrl+roda, arraste, ajuste a janela, tamanho real, fundo de transparencia e metadados do arquivo.
- Adiciona decodificacao textual com fallback UTF-8, UTF-16 e Latin-1 e persistencia da opcao de nao perguntar novamente por tipo binario.

## 26.5.1 - 2026-07-23

Type: Fix

Description:
- Traduz a interface do Chat de IA e modais auxiliares para portugues, incluindo prompts, estados, configuracoes e mensagens visiveis.
- Corrige o botao de fechar dos arquivos ao separar a acao de fechar do botao principal da aba, evitando area clicavel inconsistente.

## 26.4.0 - 2026-07-22

Type: Feature

Description:
- Adiciona o Extension Manager com Activity Bar, busca, lista de extensoes instaladas, enable/disable, reload, uninstall e instalacao local de VSIX em UserData/extensions.
- Adiciona o carregador de metadados de extensoes com extensions.json e estrutura preparada para ativacao futura sem executar codigo de extensoes nesta iteracao.
- Adiciona o pacote packages/vscode-api com placeholders iniciais para window, workspace, commands, languages, env e extensions.
- Refatora a configuracao de runtimes para language-runtimes.json com pagina dedicada, autodeteccao por PATH, validacao e deteccao de versao.

## 26.3.3 - 2026-07-21

Type: Fix

Description:
- Corrige o encerramento do pacote Linux/.deb com cleanup idempotente de janelas, WebContents, watchers, terminais e live servers.
- Corrige o empacotamento Debian para reconstruir e extrair modulos nativos compativeis com Electron, validar chrome-sandbox e declarar dependencias Linux necessarias.
- Corrige o fluxo mobile/Telefone para solicitar permissao de armazenamento antes de acessar Documents/NPSharp e manter dados internos em Directory.Data.
- Corrige referencias de versao divergentes entre Electron, Android, renderer fallback e metadata do pacote.

## 26.3.2 - 2026-07-21

Type: Fix

Description:
- Implementacao inicial do changelog do NPSharp.
