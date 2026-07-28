# CHANGELOG

## 26.8.22 - 2026-07-28

Type: Fix

Description:
- Consolida as regras de `.gitignore` para dependências, caches, artefatos de build, ambientes locais e arquivos sensíveis, removendo `node_modules` do rastreamento do Git.

## 26.8.21 - 2026-07-28

Type: Refactor

Description:
- Configura ESLint com verificação obrigatória do cabeçalho de licença CorelabsBR e aplica o cabeçalho aos arquivos de código mantidos pelo projeto.

## 26.8.20 - 2026-07-28

Type: Fix

Description:
- Remove a validação de tag de entrada do workflow de release. O pipeline agora calcula `v<package.version>` e cria ou reutiliza essa tag somente ao publicar os artefatos aprovados.

## 26.8.19 - 2026-07-28

Type: Fix

Description:
- Corrige a configuração Portable do electron-builder: usa `requestExecutionLevel: "user"`, valor aceito pelo schema do electron-builder 25.1.8.

## 26.8.18 - 2026-07-28

Type: Feature

Description:
- Adiciona a opção de restaurar o último workspace ao iniciar o NPSharp. Ao desativá-la, o workspace e os arquivos associados deixam de ser gravados para a próxima abertura.

## 26.8.17 - 2026-07-28

Type: Performance

Description:
- Adiciona perfil de startup por flag, adia restauração de sessão, tema, atualizador e carregamentos secundários até o editor estar interativo, e carrega contribuições de linguagem Monaco apenas quando o arquivo correspondente é aberto.
- Adiciona modo Portable Fast em ZIP com dados locais previsíveis, reforça o encaminhamento seguro de arquivos para instância única e configura o Setup NSIS assistido com diretório escolhível e preservação de dados.

## 26.8.16 - 2026-07-28

Type: Feature

Description:
- Define português do Brasil como idioma padrão e traduz os textos restantes da interface principal, terminal, paleta de comandos, configurações e painéis do NPSharp.
- Adiciona internacionalização persistente por `AppSettings.language` e a API segura `i18n` (`getLanguage`, `setLanguage` e `availableLanguages`) para desktop, web e mobile; o menu nativo é reconstruído ao trocar de idioma.

## 26.8.15 - 2026-07-28

Type: Feature

Description:
- Adiciona atualização automática profissional via GitHub Releases para o instalador NSIS do Windows e AppImage do Linux, com comparação SemVer, progresso real de download, prevenção de ações duplicadas, reinicialização controlada e IPC restrito entre main, preload e renderer.
- Atualiza o workflow de release para publicar somente tags `v<package.version>` e anexar os metadados e artefatos verificados pelo `electron-updater`.

## 26.8.14 - 2026-07-28

Type: Feature

Description:
- Adiciona à barra superior, ao lado de Executar, o botão textual `Baixar imports Python (.venv)` e a mesma ação no menu Executar, deixando explícito que ele prepara o ambiente local e instala as dependências do arquivo Python atual.

## 26.8.13 - 2026-07-28

Type: Feature

Description:
- Adiciona ao painel Executar e Depurar um botão para preparar as dependências do arquivo Python atual: cria ou reutiliza `.venv` no projeto, instala `requirements.txt` quando presente e baixa os pacotes correspondentes aos imports externos detectados.
- A execução de arquivos Python passa a preferir automaticamente o interpretador do `.venv` preparado no projeto, sem instalar pacotes no ambiente global.

## 26.8.12 - 2026-07-27

Type: Feature

Description:
- Amplia o abridor universal com inspeção estruturada e somente leitura de DOCX, ODT, ODS, PPTX, Pages, Numbers, Keynote, SQLite, PSD, DWG, Blender, Publisher e savegames, incluindo texto, abas, fórmulas, notas, recursos incorporados, esquema de bancos e assinaturas de formatos binários.
- Adiciona o leitor SQLite multiplataforma `sql.js`, exibindo esquema, amostras de registros e o resultado da verificação de integridade sem depender de software externo.

## 26.8.11 - 2026-07-27

Type: Fix

Description:
- Corrige a camada visual do papel de parede para mantê-la visível sobre a área de trabalho, sem bloquear a interação com o editor, menus ou barra de status.

## 26.8.10 - 2026-07-27

Type: Fix

Description:
- Corrige o Run para sempre executar o arquivo suportado mesmo quando a depuração integrada não está disponível; F5 avisa e continua sem depuração, enquanto Ctrl+F5 executa diretamente.
- Inclui todos os runtimes suportados na autodetecção/configuração e executa efetivamente binários C/C++ após compilar, além de tratar Kotlin e projetos C# pelo runtime adequado.

## 26.8.9 - 2026-07-27

Type: Fix

Description:
- Impede a paleta de comandos de recriar a opção sob o mouse ao passar sobre ela, permitindo clicar e selecionar temas normalmente pelo Theme Lab e pelo menu Aparência.

## 26.8.8 - 2026-07-27

Type: Fix

Description:
- Remove a reconstrução desnecessária dos atalhos ao alterar configurações visuais; a atualização de atalhos agora ocorre somente ao criar, remover ou redefinir atalhos, permitindo selecionar temas normalmente em todos os seletores.

## 26.8.7 - 2026-07-27

Type: Fix

Description:
- Carrega o manifesto e os arquivos de tema diretamente do bundle do renderer, preservando o fallback externo e impedindo falhas de tema em ambientes Electron com recursos `file://`.

## 26.8.6 - 2026-07-27

Type: Feature

Description:
- Corrige a tela de atalhos para carregar todos os comandos registrados, permite adicionar e remover atalhos personalizados e os salva na configuração global do NPSharp.

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
