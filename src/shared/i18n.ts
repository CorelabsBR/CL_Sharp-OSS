/** Idiomas oferecidos pela interface do NPSharp. */
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
  "Sobre o NPSharp": "About NPSharp",
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
