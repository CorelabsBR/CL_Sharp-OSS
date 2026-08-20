# CHANGELOG

## 26.8.51 - 2026-08-20

Type: Feature / Fix

Description:
- Completa a integracao Codex desktop sobre o App Server oficial, com login pela conta ChatGPT no navegador, leitura do estado da conta, exibicao de e-mail/plano, troca de conta e logout.
- Passa a carregar o catalogo de modelos disponibilizado pelo Codex para a conta autenticada em vez de manter uma lista fixa.
- Habilita o modo agente para ler, editar e testar o workspace local aberto, limitando a escrita ao caminho canonico desse workspace e mantendo rede desabilitada; sem workspace valido, usa somente leitura.
- Localiza o executavel Codex tanto no PATH quanto na extensao oficial instalada no NPSharp, VS Code, VS Code Insiders, VSCodium, Cursor ou Windsurf.
- Adiciona teste da politica de sandbox e documentacao do fluxo de conta e das garantias de credenciais.
- Corrige o botão de confirmação de exclusão do Explorer para remover arquivos e pastas da worktree durante a execução do projeto.

## 26.8.50 - 2026-08-20

Type: Feature

Description:
- Estende o autocomplete Emmet do HTML para CSS, SCSS, LESS, XML, PHP, Handlebars, Razor, JSX e TSX, com expansoes adequadas a cada dialeto.
- Permite aceitar as novas expansoes tanto pelo menu de sugestoes quanto diretamente pela tecla Tab, sem habilitar marcacao HTML em arquivos JavaScript ou TypeScript comuns.
- Adiciona cobertura automatizada para selecao de dialeto e expansoes JSX, CSS e XML.

## 26.8.49 - 2026-08-20

Type: Feature

Description:
- Adiciona um backend Git nativo para Android baseado em JGit, habilitando descoberta de repositorios, init, clone HTTPS, status, stage, commit, checkout, branches, diff, historico, stash, fetch, pull e push nos workspaces mobile do NPSharp.
- Integra o backend Android ao mesmo painel Source Control usado no desktop e informa claramente quando uma pasta externa SAF nao pode fornecer um caminho nativo ao Git.
- Adiciona autenticacao HTTPS sob demanda para repositorios privados, mantendo usuario e token somente na memoria do processo Android e repetindo a operacao remota apos o login.
- Solicita nome e e-mail no primeiro commit mobile e salva a identidade somente na configuracao local daquele repositorio.
- Transpila o bundle mobile para Chromium 80+, evitando tela preta por sintaxe JavaScript moderna em WebViews presentes no Android 11.
- Inclui compatibilidade para APIs DOM, String, Array, referências fracas e `crypto.randomUUID` ausentes em Android System WebView antigos usados por aparelhos Android 11.
- Registra os plugins nativos antes da criacao da ponte Capacitor e faz o Git operar no mesmo `Documents/NPSharp` usado pelo editor, garantindo que status, stage e commit enxerguem os arquivos reais do workspace.
- Usa a linha JGit 5.13 compativel com as APIs Java disponiveis no Android 11, evitando encerramento do app ao consultar o status do repositorio.

## 26.8.48 - 2026-08-19

Type: Feature / Refactor

Description:
- Substitui o expansor HTML parcial pelo motor oficial Emmet 2 usado na integração do VS Code, com sugestões dinâmicas e prévia da expansão no autocomplete.
- Amplia abreviações HTML com classes e IDs, filhos, irmãos, subida de nível, repetição, numeração, atributos, texto, tags implícitas e snippets padrão do Emmet.
- Garante expansões como `div.card` para `<div class="card"></div>` pelo Tab, preservando placeholders navegáveis do Monaco.

## 26.8.47 - 2026-08-19

Type: Feature

Description:
- Torna a descoberta de snippets proativa: o NPSharp acompanha o prefixo digitado e abre o autocomplete assim que encontra atalhos compatíveis com a linguagem ativa.
- Mantém todos os snippets registrados disponíveis pelo `Ctrl+Espaço`, prioriza snippets na lista e atualiza os candidatos enquanto o prefixo é completado.

## 26.8.46 - 2026-08-19

Type: Feature / Fix

Description:
- Adiciona um registro genérico e ilimitado de snippets por linguagem, exibido no autocomplete e expandido diretamente com Tab.
- Adiciona o snippet Java `psvm`, que gera `public static void main(String[] args)`, e centraliza snippets internos em arquivos editáveis `resources/snippets/<linguagem>.json` compatíveis com o formato do VS Code.
- Corrige a ativação de snippets fornecidos por extensões, que já eram reconhecidos no manifesto mas ainda não tinham seus arquivos carregados pelo editor.
- Corrige a expansão por Tab usando diretamente o controlador modular de snippets do Monaco, pois o comando global `editor.action.insertSnippet` não existe nessa distribuição.
- Monitora o prefixo digitado e abre automaticamente o autocomplete com todos os snippets compatíveis da linguagem, incluindo contribuições instaladas por extensões.

## 26.8.45 - 2026-08-19

Type: Feature

Description:
- Adiciona o campo opcional `cat` aos temas do pacote e de extensões para criar categorias personalizadas e agrupar automaticamente todos os temas com o mesmo nome de categoria.
- Mantém Dark e Light como categorias automáticas de fallback quando `cat` não é informado.

## 26.8.44 - 2026-08-19

Type: Feature

Description:
- Separa os temas nas categorias Dark e Light em todos os seletores, classificando `vs-dark` como Dark e `vs` como Light, inclusive para temas fornecidos por extensões.
- Adiciona cabeçalhos de categoria ao seletor rápido e à página de Aparência, além de grupos nativos no seletor exibido pela pesquisa de configurações.

## 26.8.43 - 2026-08-19

Type: Feature

Description:
- Adiciona autocomplete Emmet ao editor HTML, com sugestões em formato de snippet, placeholders navegáveis e expansão direta pelo Tab, como no VS Code.
- Permite gerar o documento HTML5 completo com `!` ou `html:5` e expandir abreviações comuns, seletores de classe/ID, hierarquia e repetição, como `div.container`, `ul>li*3`, `link:css` e `script:src`.
- Carrega as contribuições de Suggest e Snippet do Monaco para disponibilizar o mesmo fluxo de aceite e navegação encontrado em editores como o VS Code.
- Garante que o Tab expanda a abreviação antes de ser consumido pelo widget interno do Monaco e reconhece `!` também em um documento novo ainda identificado como texto simples.
- Ativa os language services completos do Monaco para HTML, CSS, SCSS, JavaScript e TypeScript e amplia o autocomplete por palavras-chave para Python, Java, Kotlin, C/C++, C#, Go, Rust, PHP, Ruby, Shell e SQL.
- Exibe sugestões automaticamente durante a digitação, incluindo palavras, snippets, métodos, funções, classes, propriedades, variáveis, valores, módulos e demais símbolos disponíveis.

## 26.8.42 - 2026-08-18

Type: Feature / Fix / Refactor / Performance

Description:
- Restaura a configuração e os entrypoints da suíte `test:features`, incluindo cobertura executável para busca, Git, Command Registry, fuzzy matching e Quick Open.
- Restaura os módulos-fonte de Command Registry, Quick Open, contribuições de extensões e Monaco Diff Viewer que estavam referenciados pelo renderer, mas ausentes do projeto, corrigindo a resolução de imports do Vite.
- Centraliza comandos do workbench em um Command Registry tipado e conecta Command Palette, atalhos personalizados e comandos enviados pelos menus Electron ao mesmo caminho de execução.
- Evolui Quick Open com índice assíncrono no backend, fuzzy ranking, destaque de correspondências, arquivos recentes, ignores do workspace e abertura em `arquivo:linha:coluna`.
- Completa a busca global com include/exclude, regex, case-sensitive, whole word, cancelamento real de requisições, `.gitignore`, resultados agrupados e Replace in Files.
- Reestrutura o Source Control em Changes, Staged Changes, Untracked e Conflicts, adicionando trava de operações, amend, stash, stash pop, branches e feedback detalhado.
- Integra o Monaco Diff Editor ao sistema existente de abas para comparações HEAD, index e working tree, incluindo arquivos novos, removidos e renomeados.
- Torna extensões declarativas funcionais com validação de contributions, ativação e descarregamento dinâmicos de temas, linguagens, Monarch, configurações, snippets e comandos seguros.
- Reforça a segurança de arquivos de extensão contra path traversal e symlinks externos e adiciona testes de registry, fuzzy matching, Quick Open, busca, Git e manifests/contributions.
- Restringe o scanner de dependências do Vite ao `index.html` da aplicação, ignorando fixtures HTML, relatórios Gradle, assets Android e artefatos de release durante o desenvolvimento.
- Corrige os ícones quebrados da Open VSX com permissão de origem restrita e fallback automático, e refina o visual dos cards de extensões.
- Limita o papel de parede à área do editor, preservando fundos sólidos e legíveis no Explorer, painéis laterais e terminal.
- Mantém a opção selecionada da Command Palette visível durante a navegação pelas setas do teclado.
- Adiciona suporte a imagens JFIF no seletor de papel de parede e no visualizador, com indicação dos formatos aceitos.
- Implementa a abertura real de múltiplas janelas e vincula minimizar, maximizar e fechar à janela que originou o comando.
- Corrige a decodificação de mensagens localizadas de compiladores no Windows, preservando acentos em diagnósticos como “parâmetros”.

## 26.8.41 - 2026-08-12

Type: Fix

Description:
- Corrige a instalação do NPSharp Server em hosts Linux removendo a transferência obrigatória de um `node-pty` nativo da máquina cliente e usando Node.js para verificar o checksum sem depender de `sha256sum`.
- Permite a conexão quando o terminal PTY opcional não está disponível, preservando filesystem, workspace, processos e watchers, e inclui o log remoto no diagnóstico de falha de inicialização.
- Adiciona teste ponta a ponta do bootstrap autenticado, conexão WebSocket e RPC de capabilities do servidor.
- Corrige os runners desktop para compilar o artefato do NPSharp Server em cada job e torna os downloads do Electron resilientes com cache e tentativas limitadas.
- Substitui todas as chamadas incompatíveis a `window.prompt` por diálogos internos assíncronos nos comandos de projeto, Git, Explorer, Arduino, IA e sandbox web/mobile.
- Corrige instalações novas do NPSharp Server criando o diretório remoto `bin` antes de mover a versão instalada.
- Redesenha a janela Sobre com identidade visual do NPSharp, informações de build e runtime, sistema, arquitetura, caminhos, licença, repositório e cópia de diagnóstico.
- Alinha as capabilities RPC `process` e `watch` entre cliente e servidor remoto, preservando aliases antigos para compatibilidade.
- Torna a sessão Remote Host o contexto ativo do Explorer, terminal, busca/substituição e extensões, executando essas operações e instalações Open VSX no host conectado em vez da máquina local.
- Adiciona um seletor navegável de pasta remota após a conexão, com sugestões consultadas via RPC enquanto o caminho é digitado, navegação por teclado e confirmação explícita do workspace.
- Bloqueia caminhos e diálogos locais no Explorer enquanto uma sessão remota está ativa, redirecionando botões, atalhos, recentes e restauração para o seletor do host.
- Permite navegar a árvore remota desde `/`, respeitando as permissões do usuário SSH, em vez de limitar o seletor somente ao diretório home.
- Remove o carregamento antecipado do binário Electron pelo serviço de arquivos, permitindo executar testes Node no CI sem baixar o runtime gráfico desnecessariamente.
- Corrige a seleção de shell por ambiente: cmd no Windows, `$SHELL` local (incluindo fish) e shell detectado no host remoto; no Linux sem `node-pty`, usa `/usr/bin/script` como PTY real em vez do fallback por pipes.
- Evita carregar `node-pty` quando não existe binário nativo compatível, removendo o stack trace no Linux e selecionando diretamente o PTY fornecido por `/usr/bin/script`.
- Corrige a compilação Android removendo o uso de `Process.pid()`, API inexistente no `java.lang.Process` fornecido pelo SDK Android; o PID já é opcional no contrato do terminal.
- Melhora a legibilidade do terminal com cores ANSI seguras, maior contraste e espaçamento, fonte monoespaçada, rolagem horizontal e linha de entrada destacada com o shell ativo.

## 26.8.40 - 2026-08-06

Type: Feature / Fix

Description:
- Adiciona integração nativa com Discord Rich Presence no processo principal, com contexto de arquivo, projeto, linguagem, execução, terminal e Remote Host.
- Adiciona preferências de privacidade, imagens e Application ID configurável, sem publicar caminhos completos ou credenciais.
- Adiciona debounce, deduplicação, reconexão progressiva, limpeza no encerramento, IPC seguro e testes do gerador de atividade.
- Corrige o Remote Host no Electron substituindo diálogos `prompt()` não suportados por um modal interno para host, senha, pasta e operações remotas.
- Corrige instalações da Open VSX que retornavam 404 usando a URL oficial de download informada pelo registro, com validação de origem e identidade da extensão.
- Corrige a descoberta do executável Codex empacotado pela extensão no Linux e macOS e amplia a busca para instalações do VS Code, Insiders, VSCodium, Cursor e Windsurf.
- Corrige conexões remotas duplicadas reutilizando a operação em andamento para o mesmo host e bloqueando novos cliques no painel até sua conclusão.
- Migra o provedor Codex com login ChatGPT dos modelos legados incompatíveis para GPT-5.6 Sol e atualiza o seletor com a família GPT-5.6.

## 26.8.39 - 2026-08-06

Type: Feature

Description:
- Completa o fluxo `Remote Host: Connect` com SSH persistente, validação de host key, detecção de plataforma, instalação SFTP versionada e verificada por SHA-256, bootstrap estruturado, túnel local e RPC WebSocket autenticado.
- Integra workspaces `npsharp-remote://` ao Explorer e Monaco, incluindo operações de arquivos, proteção por `etag`, watchers agrupados, terminal remoto PTY e execução remota pelo Run Button.
- Adiciona estados e logs de conexão, rollback, cancelamento, reconexão, limpeza no encerramento, comandos da Command Palette e testes do protocolo e proteção de caminhos.
- Corrige o artefato remoto para incluir seu `package.json` ESM; instalações incompletas anteriores são detectadas e reinstaladas automaticamente em vez de falharem aguardando o bootstrap.

## 26.8.38 - 2026-08-06

Type: Feature

Description:
- Introduz a base tipada do NPSharp Remote Host: estados de conexão, protocolo RPC validado, códigos de erro e abstração de filesystem local/remoto com URI `npsharp-remote://`.
- Protege conexões SSH com verificação obrigatória de fingerprint, keepalive e timeouts configuráveis, sem aceitar silenciosamente chaves desconhecidas ou alteradas.
- Adiciona armazenamento de credenciais criptografado pelo `safeStorage`, IDs persistentes de hosts e arquivos de configuração com permissões restritas.
- Detecta conflitos de edição por `etag` antes de salvar arquivos remotos e retorna `REMOTE_FILE_MODIFIED` em vez de sobrescrever alterações externas.
- Inclui um NPSharp Server compilável e empacotado, autenticado por token e limitado a `127.0.0.1`, com RPC funcional para sistema, workspace, filesystem e processos, limite de mensagens e restrição a raízes autorizadas.

## 26.8.37 - 2026-07-28

Type: Feature

Description:
- Substitui o workspace virtual do Android pelo seletor nativo de pastas (Storage Access Framework), com permissão persistente para ler e gravar diretamente no local escolhido pelo usuário.
- Exibe no Explorer a localização da pasta escolhida e restaura o nome e a URI do workspace ao reabrir o aplicativo.

## 26.8.36 - 2026-07-28

Type: Feature

Description:
- Integra o LibreOffice instalado ao NPSharp para editar documentos e planilhas no arquivo original, preservando formatação avançada, mídia, fórmulas e revisões suportadas pela suíte.
- Adiciona as ações `Editar no LibreOffice` no Explorer e `Office: Editar arquivo atual no LibreOffice` na Command Palette.

## 26.8.35 - 2026-07-28

Type: Feature

Description:
- Torna arquivos NBT editáveis como JSON e grava novamente o conteúdo em NBT binário, preservando também a compactação gzip quando usada.
- Adiciona leitura e edição de planilhas XLSX, XLS, XLSM, XLSB, ODS, CSV e TSV, inclusive arquivos produzidos por Excel e LibreOffice.
- Adiciona abertura e edição de texto para DOCX, ODT e ODF, com gravação em contêineres compatíveis com Microsoft Word e OpenDocument.

## 26.8.34 - 2026-07-28

Type: Feature

Description:
- Adiciona um shell Android persistente e integrado ao terminal do NPSharp, executado no sandbox do aplicativo sem exigir a instalação do Termux.
- Ajusta a Command Palette para telas de telefone: painel inferior de largura total, controles de toque maiores e lista sem arraste horizontal.

## 26.8.33 - 2026-07-28

Type: Fix

Description:
- Declara o `7zip-bin` como dependência direta do empacotamento Portable Fast, garantindo que o compactador esteja disponível em instalações limpas do CI Windows e Linux.

## 26.8.32 - 2026-07-28

Type: Fix

Description:
- Eleva o `minSdk` Android para API 24, requisito do `cordova-android 14` usado pelos plugins Capacitor, corrigindo a mesclagem de manifestos sem ignorar a incompatibilidade em tempo de execução.

## 26.8.31 - 2026-07-28

Type: Fix

Description:
- Atualiza o `compileSdk` e as Build Tools Android para API 36, compatibilizando o aplicativo com `androidx.activity 1.11.0` e `androidx.core 1.17.0` durante a validação AAR do Gradle.

## 26.8.30 - 2026-07-28

Type: Feature

Description:
- A execução de Portugol agora pausa em `leia(...)`, ativa a entrada do terminal e continua somente depois que o usuário confirma o valor com Enter.

## 26.8.29 - 2026-07-28

Type: Fix

Description:
- Faz o Error Lens acompanhar todos os marcadores do Monaco, incluindo diagnósticos nativos da linguagem, e exibir as mensagens consolidadas diretamente na linha afetada.
- Adiciona marcadores de severidade ao minimapa e à régua de visão geral, mantendo os erros visíveis mesmo em arquivos grandes.

## 26.8.28 - 2026-07-28

Type: Fix

Description:
- Alinha as bibliotecas AndroidX às versões compatíveis com Capacitor 8, Android Gradle Plugin 8.13 e `compileSdk 35`, corrigindo a validação de metadados AAR no build Android.

## 26.8.27 - 2026-07-28

Type: Feature

Description:
- Novos arquivos `.gol` criados pelo Explorer recebem um exemplo Portugol pronto para executar, sem alterar arquivos existentes ou criados fora do NPSharp.

## 26.8.26 - 2026-07-28

Type: Fix

Description:
- Remove a chave `linux.desktop` descontinuada do electron-builder 26 para permitir a geração dos pacotes Linux.

## 26.8.25 - 2026-07-28

Type: Fix

Description:
- Corrige a leitura de `config.json` no workflow de release para evitar aspas aninhadas inválidas no Bash e publicar os metadados centralizados corretamente.

## 26.8.24 - 2026-07-28

Type: Refactor

Description:
- Adiciona `config.json` como fonte única de verdade para identidade do aplicativo, versões, dependências, empacotamento Electron, Capacitor, Android e metadados de release.
- Sincroniza automaticamente os manifestos e configurações derivadas antes dos comandos de desenvolvimento e compilação.

## 26.8.23 - 2026-07-28

Type: Refactor

Description:
- Atualiza as dependências npm diretas, as bibliotecas Android, o Android Gradle Plugin e o Google Services Plugin.
- Adapta a integração do Monaco Editor à estrutura de módulos da versão atual e usa o perfil ProGuard otimizado suportado pelas versões atuais do AGP.
- Mantém TypeScript 5.9.3 e AGP 8.13.2 como as versões mais recentes compatíveis com `typescript-eslint` e Capacitor 8, respectivamente.

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
