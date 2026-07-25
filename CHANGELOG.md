# CHANGELOG

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
