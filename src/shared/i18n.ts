/*---------------------------------------------------------------------------------------------
- Copyright (c) CorelabsBR. All rights reserved.
- Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
/** Idiomas oferecidos pela interface do Sharp-OSS. */
export const SUPPORTED_LOCALES = ["pt-BR", "en-US"] as const;

export type AppLocale = typeof SUPPORTED_LOCALES[number];

export const DEFAULT_LOCALE: AppLocale = "pt-BR";

export const LOCALE_LABELS: Record<AppLocale, string> = {
  "pt-BR": "Português (Brasil)",
  "en-US": "English (United States)"
};

export function normalizeLocale(locale: unknown): AppLocale {
  return SUPPORTED_LOCALES.includes(locale as AppLocale) ? locale as AppLocale : DEFAULT_LOCALE;
}

/**
 * Traduções de interface que são compartilhadas entre o processo principal e
 * o renderer. A chave é sempre a forma em português, para que o padrão da
 * aplicação permaneça legível mesmo quando uma nova chave ainda não tiver
 * tradução para outro idioma.
 */
const EN_US: Record<string, string> = {
  "Arquivo": "File",
  "Novo": "New",
  "Abrir...": "Open...",
  "Salvar": "Save",
  "Salvar Como...": "Save As...",
  "Salvar Tudo": "Save All",
  "Fechar Editor": "Close Editor",
  "Reabrir Editor Fechado": "Reopen Closed Editor",
  "Fechar Todos os Editores": "Close All Editors",
  "Abrir pasta...": "Open Folder...",
  "Sair": "Quit",
  "Editar": "Edit",
  "Desfazer": "Undo",
  "Refazer": "Redo",
  "Recortar": "Cut",
  "Copiar": "Copy",
  "Colar": "Paste",
  "Localizar": "Find",
  "Substituir": "Replace",
  "Localizar nos arquivos": "Find in Files",
  "Substituir nos arquivos": "Replace in Files",
  "Comentar linha": "Comment Line",
  "Descomentar linha": "Uncomment Line",
  "Comentar bloco": "Comment Block",
  "Ir para a linha": "Go to Line",
  "Ir para o início": "Go to Start",
  "Ir para o fim": "Go to End",
  "Formatar documento": "Format Document",
  "Exibir": "View",
  "Explorador": "Explorer",
  "Pesquisar": "Search",
  "Controle de código-fonte": "Source Control",
  "Executar e depurar": "Run and Debug",
  "Terminal": "Terminal",
  "Alternar painel": "Toggle Panel",
  "Problemas": "Problems",
  "Saída": "Output",
  "Atalhos de teclado": "Keyboard Shortcuts",
  "Extensões": "Extensions",
  "Ampliar": "Zoom In",
  "Reduzir": "Zoom Out",
  "Redefinir zoom": "Reset Zoom",
  "Tela cheia": "Full Screen",
  "Ferramentas": "Tools",
  "Compilar projeto": "Build Project",
  "Executar arquivo atual": "Run Current File",
  "Executar sem depuração": "Run Without Debugging",
  "Depurar programa": "Debug Program",
  "Configurar runtimes de linguagem": "Configure Language Runtimes",
  "Novo terminal": "New Terminal",
  "Console de depuração": "Debug Console",
  "Portas": "Ports",
  "Limpar terminal": "Clear Terminal",
  "Encerrar processo": "Terminate Process",
  "Fechar terminal": "Close Terminal",
  "Mais": "More",
  "Paleta de comandos": "Command Palette",
  "Central de comandos": "Command Center",
  "Verificar atualizações": "Check for Updates",
  "Instalar extensão de VSIX": "Install VSIX Extension",
  "Sobre o Sharp-OSS": "About Sharp-OSS",
  "Idioma": "Language",
  "Escolha o idioma da interface. A aplicação será recarregada.": "Choose the interface language. The application will reload.",
  "Configurações": "Settings",
  "Configurações salvas": "Settings saved",
  "Nenhuma configuração encontrada.": "No settings found.",
  "Resultados da pesquisa": "Search results",
  "Aparência": "Appearance",
  "Editor": "Editor",
  "Diagnósticos": "Diagnostics",
  "Compilação": "Build",
  "Área de trabalho": "Workbench"
  ,"Abrir": "Open"
  ,"Atualizar": "Refresh"
  ,"Cancelar": "Cancel"
  ,"Confirmar": "Confirm"
  ,"Configurar": "Configure"
  ,"Excluir": "Delete"
  ,"Executar": "Run"
  ,"Fechar": "Close"
  ,"Parar": "Stop"
  ,"Recarregar": "Reload"
  ,"Redefinir": "Reset"
  ,"Remover": "Remove"
  ,"Repositório": "Repository"
  ,"Substituir tudo": "Replace All"
  ,"Gerenciar": "Manage"
  ,"Adicionar atalho": "Add Keybinding"
  ,"Remover atalho personalizado": "Remove Custom Keybinding"
  ,"Novo atalho": "New Keybinding"
  ,"Nenhum atalho encontrado.": "No keybindings found."
  ,"Pesquisar...": "Search..."
  ,"Procurar...": "Browse..."
  ,"Digite para pesquisar": "Type to search"
  ,"Pesquisar configurações": "Search settings"
  ,"Pesquisar extensões": "Search extensions"
  ,"Pesquisar conversas": "Search conversations"
  ,"Pesquisar por comando, categoria ou teclas": "Search by command, category, or keys"
  ,"Pesquisa rápida de arquivos": "Quick file search"
  ,"Incluir: *.ts, src/**": "Include: *.ts, src/**"
  ,"Excluir: node_modules, dist/**": "Exclude: node_modules, dist/**"
  ,"Diferenciar maiúsculas/minúsculas": "Match case"
  ,"Palavra inteira": "Whole word"
  ,"Aparencia": "Appearance"
  ,"Paleta de comandos...": "Command Palette..."
  ,"Tema de cores...": "Color Theme..."
  ,"Selecionar tema de cores": "Select Color Theme"
  ,"Escolher": "Choose"
  ,"Wallpaper...": "Wallpaper..."
  ,"Escolher papel de parede": "Choose Wallpaper"
  ,"Remover papel de parede": "Remove Wallpaper"
  ,"Ativar ErrorLens": "Enable ErrorLens"
  ,"Desativar ErrorLens": "Disable ErrorLens"
  ,"Backup e sincronização de configurações...": "Settings Backup and Sync..."
  ,"Baixar atualização (1)": "Download Update (1)"
  ,"Tema": "Theme"
  ,"Tema visual da interface.": "Interface color theme."
  ,"Tema de ícones": "Icon Theme"
  ,"Default preserva as cores dos ícones; Monocromático usa a cor definida abaixo.": "Default preserves icon colors; Monochrome uses the color defined below."
  ,"Padrão": "Default"
  ,"Monocromático": "Monochrome"
  ,"Cor dos ícones": "Icon Color"
  ,"Cor CSS usada pelo tema de ícones monocromático, por exemplo #c5c5c5.": "CSS color used by the monochrome icon theme, for example #c5c5c5."
  ,"Caminho do papel de parede": "Wallpaper Path"
  ,"Caminho da imagem de fundo.": "Background image path."
  ,"Opacidade do papel de parede": "Wallpaper Opacity"
  ,"Opacidade da imagem de fundo.": "Background image opacity."
  ,"Fonte": "Font"
  ,"Fonte do editor": "Editor Font"
  ,"Fonte usada no editor.": "Font used in the editor."
  ,"Tamanho da fonte": "Font Size"
  ,"Tamanho usado no editor.": "Font size used in the editor."
  ,"Tamanho do tab": "Tab Size"
  ,"Largura de cada tabulação no editor.": "Width of each tab in the editor."
  ,"Quebra automática": "Word Wrap"
  ,"Quebra linhas longas.": "Wraps long lines."
  ,"Números de linha": "Line Numbers"
  ,"Mostra os números das linhas.": "Shows line numbers."
  ,"Salvar automaticamente": "Auto Save"
  ,"Salva automaticamente.": "Saves automatically."
  ,"Formatar ao salvar": "Format on Save"
  ,"Formata ao salvar.": "Formats files when saving."
  ,"Nome especial da marca": "Special Brand Name"
  ,"Destaque personalizado da marca em rosa.": "Custom brand highlight in pink."
  ,"Terminal ativado": "Terminal Enabled"
  ,"Ativa o terminal integrado.": "Enables the integrated terminal."
  ,"Shell do Windows": "Windows Shell"
  ,"Shell padrão no Windows.": "Default shell on Windows."
  ,"Shell do Linux/macOS": "Linux/macOS Shell"
  ,"Shell padrão no Linux e macOS.": "Default shell on Linux and macOS."
  ,"Diretório inicial": "Initial Directory"
  ,"Diretório inicial do terminal.": "Terminal initial directory."
  ,"Diagnósticos ativados": "Diagnostics Enabled"
  ,"Ativa diagnósticos.": "Enables diagnostics."
  ,"ErrorLens ativado": "ErrorLens Enabled"
  ,"Mostra diagnósticos na linha.": "Shows inline diagnostics."
  ,"Mostra diagnósticos na linha no editor.": "Shows inline diagnostics in the editor."
  ,"Compilar ao salvar": "Compile on Save"
  ,"Compila Java ao salvar.": "Compiles Java when saving."
  ,"Abrir problemas automaticamente": "Open Problems Automatically"
  ,"Abre Problemas quando os diagnósticos falham.": "Opens Problems when diagnostics fail."
  ,"Comando de compilação": "Build Command"
  ,"Comando usado para compilar.": "Command used to build."
  ,"Comando usado para compilar o projeto.": "Command used to build the project."
  ,"Pular testes": "Skip Tests"
  ,"Pula testes durante a compilação.": "Skips tests during the build."
  ,"Ativar Rich Presence": "Enable Rich Presence"
  ,"Publica o contexto da IDE no Discord Desktop.": "Publishes IDE context to Discord Desktop."
  ,"ID da aplicação criada no Discord Developer Portal. Vazio mantém a integração inativa.": "Application ID created in the Discord Developer Portal. Leave empty to disable the integration."
  ,"Mostrar nome do arquivo": "Show File Name"
  ,"Publica apenas o nome, nunca o caminho completo.": "Publishes only the name, never the full path."
  ,"Mostrar projeto": "Show Project"
  ,"Publica o nome do workspace atual.": "Publishes the current workspace name."
  ,"Mostrar linguagem": "Show Language"
  ,"Publica a linguagem do arquivo ativo.": "Publishes the active file language."
  ,"Mostrar host remoto": "Show Remote Host"
  ,"Publica o alias do Remote Host conectado.": "Publishes the connected Remote Host alias."
  ,"Mostrar tempo decorrido": "Show Elapsed Time"
  ,"Exibe há quanto tempo o Sharp-OSS está aberto.": "Shows how long Sharp-OSS has been open."
  ,"Mostrar tipo de workspace": "Show Workspace Type"
  ,"Identifica workspaces locais e remotos.": "Identifies local and remote workspaces."
  ,"Imagem principal": "Large Image"
  ,"Asset key configurada no Discord Developer Portal.": "Asset key configured in the Discord Developer Portal."
  ,"Texto da imagem principal": "Large Image Text"
  ,"Texto exibido ao passar o mouse sobre a imagem.": "Text shown when hovering over the image."
  ,"Botão — rótulo": "Button — Label"
  ,"Rótulo opcional do primeiro botão (máximo de dois no protocolo).": "Optional label for the first button (maximum of two in the protocol)."
  ,"Botão — URL HTTPS": "Button — HTTPS URL"
  ,"Somente URLs HTTPS válidas são publicadas.": "Only valid HTTPS URLs are published."
  ,"Reconectar ao Discord": "Reconnect to Discord"
  ,"Limpar atividade": "Clear Activity"
  ,"Barra de status visível": "Status Bar Visible"
  ,"Mostra a barra de status inferior.": "Shows the bottom status bar."
  ,"Barra de atividades visível": "Activity Bar Visible"
  ,"Mostra a barra de atividades.": "Shows the activity bar."
  ,"Barra lateral visível": "Side Bar Visible"
  ,"Mostra o painel lateral.": "Shows the side panel."
  ,"Restaurar último workspace ao iniciar": "Restore Last Workspace on Startup"
  ,"Reabre automaticamente o workspace que estava aberto ao fechar o Sharp-OSS.": "Automatically reopens the workspace that was open when Sharp-OSS closed."
  ,"Confirmar exclusão": "Confirm Delete"
  ,"Pede confirmação antes de excluir arquivos e pastas no Explorer.": "Asks for confirmation before deleting files and folders in Explorer."
  ,"CENTRAL DE COMANDOS": "COMMAND CENTER"
  ,"Centro de Comando": "Command Center"
  ,"Abra, rode e organize seu workspace sem sair do editor.": "Open, run, and organize your workspace without leaving the editor."
  ,"Projetos recentes": "Recent Projects"
  ,"Ultimos workspaces": "Recent Workspaces"
  ,"Atalhos recentes": "Recent Shortcuts"
  ,"Nenhum projeto recente ainda.": "No recent projects yet."
  ,"Abra uma pasta para iniciar o historico.": "Open a folder to start your history."
  ,"EXPLORADOR": "EXPLORER"
  ,"PROBLEMAS": "PROBLEMS"
  ,"SAÍDA": "OUTPUT"
  ,"CONSOLE DE DEPURAÇÃO": "DEBUG CONSOLE"
  ,"PORTAS": "PORTS"
  ,"TERMINAL": "TERMINAL"
  ,"Ambientes de execução": "Runtime Environments"
  ,"Configurações de IA": "AI Settings"
  ,"Chat de IA": "AI Chat"
  ,"Enviar mensagem": "Send Message"
  ,"Mensagem do chat": "Chat Message"
  ,"Modelo de IA": "AI Model"
  ,"Provedor de IA": "AI Provider"
  ,"Nova conversa": "New Conversation"
  ,"Enviar": "Send"
  ,"Geração interrompida": "Generation Stopped"
  ,"Copiar resposta": "Copy Response"
  ,"Remover contexto": "Remove Context"
  ,"Carregando modelos…": "Loading models…"
  ,"Verificando a conta Codex…": "Checking Codex account…"
  ,"Entrar com ChatGPT": "Sign in with ChatGPT"
  ,"Sair da conta": "Sign Out"
  ,"Nenhum problema encontrado no workspace.": "No problems found in the workspace."
  ,"Nenhuma extensão encontrada na Open VSX.": "No extensions found on Open VSX."
  ,"A instalação local de VSIX requer o backend Electron de desktop.": "Local VSIX installation requires the desktop Electron backend."
  ,"Desinstalar": "Uninstall"
  ,"Pronto": "Ready"
  ,"Configurações abertas": "Settings opened"
  ,"Configurações fechadas": "Settings closed"
  ,"Configurações redefinidas": "Settings reset"
  ,"Atalhos de teclado abertos": "Keyboard Shortcuts opened"
  ,"Atalho cancelado": "Keybinding canceled"
  ,"+ Contexto": "+ Context"
  ,"Abrir pasta no host remoto": "Open Folder on Remote Host"
  ,"Abrir pasta remota": "Open Remote Folder"
  ,"AMBIENTE DE DESENVOLVIMENTO": "DEVELOPMENT ENVIRONMENT"
  ,"Arquivos HTML podem usar preview interno. Outras linguagens dependem de backend nativo futuro.": "HTML files can use the built-in preview. Other languages depend on a future native backend."
  ,"Árvore de trabalho limpa": "Working tree clean"
  ,"Baixar imports Python (.venv)": "Download Python Imports (.venv)"
  ,"Caminho do sketch": "Sketch Path"
  ,"Carregando runtimes...": "Loading runtimes..."
  ,"Código sem distrações. Ferramentas locais e remotas em um único workspace.": "Distraction-free code. Local and remote tools in a single workspace."
  ,"Código, controle e domínio": "Code, Control, and Ownership"
  ,"Comando": "Command"
  ,"Comando remoto": "Remote Command"
  ,"Copiar detalhes": "Copy Details"
  ,"Copiar diagnóstico": "Copy Diagnostics"
  ,"Cria ou reutiliza o .venv do projeto e instala os imports do arquivo Python atual": "Creates or reuses the project's .venv and installs imports from the current Python file"
  ,"Detecção automática": "Automatic Detection"
  ,"Digite um caminho ou escolha uma pasta abaixo.": "Enter a path or choose a folder below."
  ,"Entrada do programa...": "Program input..."
  ,"Esta ação removerá o item do disco.": "This action will remove the item from disk."
  ,"Ex.: Ctrl+Alt+K": "E.g.: Ctrl+Alt+K"
  ,"Licenciado sob MIT · Feito por desenvolvedores, para desenvolvedores.": "Licensed under MIT · Made by developers, for developers."
  ,"Mensagem do commit": "Commit Message"
  ,"Não foi possível iniciar o Sharp-OSS": "Sharp-OSS Could Not Start"
  ,"Nenhum repositório": "No Repository"
  ,"Novo arquivo": "New File"
  ,"O arquivo é grande demais para ser incorporado com segurança. A prévia hexadecimal abaixo permite inspecioná-lo.": "The file is too large to embed safely. The hexadecimal preview below lets you inspect it."
  ,"O Chat de IA não pôde ser inicializado.": "AI Chat could not be initialized."
  ,"Os caminhos dos executáveis são armazenados em language-runtimes.json.": "Executable paths are stored in language-runtimes.json."
  ,"Parar geração": "Stop Generation"
  ,"Pergunte ao Sharp-OSS AI… (Ctrl+Enter para enviar)": "Ask Sharp-OSS AI… (Ctrl+Enter to send)"
  ,"Pergunte sobre o seu código, anexe contexto do editor ou use uma ação de IA no menu de contexto do editor.": "Ask about your code, attach editor context, or use an AI action from the editor context menu."
  ,"Permitir commit vazio": "Allow Empty Commit"
  ,"Preferências do Sharp-OSS": "Sharp-OSS Preferences"
  ,"Selecione a placa": "Select a Board"
  ,"Selecione a porta": "Select a Port"
  ,"Seu nome nos commits": "Your name in commits"
  ,"seu-email@exemplo.com": "your-email@example.com"
  ,"Token pessoal; mantido somente nesta sessão": "Personal token; kept only for this session"
  ,"Usuário do GitHub, GitLab ou servidor Git": "GitHub, GitLab, or Git server username"
  ,"Validar": "Validate"
};

export function t(locale: AppLocale, portuguese: string): string {
  return locale === "en-US" ? EN_US[portuguese] ?? portuguese : portuguese;
}

let uiLocale: AppLocale = DEFAULT_LOCALE;

/** Configura a tradução usada pelos componentes DOM do renderer. */
export function setUiLocale(locale: unknown): void {
  uiLocale = normalizeLocale(locale);
}

export function uiText(portuguese: string): string {
  return t(uiLocale, portuguese);
}
