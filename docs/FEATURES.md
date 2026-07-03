# Funcionalidades do NPSharp

## Visão Geral

O NPSharp oferece um conjunto completo de funcionalidades para desenvolvimento de código. Esta documentação lista todas as funcionalidades identificadas no repositório.

## 1. Editor de Código com Múltiplas Abas

### Descrição
Editor principal com suporte a múltiplas arquivos abertos simultaneamente em abas.

### Localização
- **Classe Principal:** [EditorManager.java](../src/main/java/br/com/corelabs/npsharpfx/frontend/ui/editor/EditorManager.java)
- **Componente:** [CodeArea (RichTextFX)](../src/main/java/br/com/corelabs/npsharpfx/frontend/ui/editor/EditorManager.java)

### Como Usar
- **Abrir arquivo:** Menu File → Open ou Ctrl+O
- **Novo arquivo:** Ctrl+N
- **Salvar:** Ctrl+S
- **Salvar como:** Ctrl+Shift+S
- **Fechar aba:** Clique no X ou Ctrl+W

### Métodos Relevantes
```java
void openFile(File file)              // Abre arquivo em nova aba
void saveFile(Tab tab)                // Salva arquivo
void saveAs(Tab tab)                  // Salva como novo arquivo
void closeTab(Tab tab)                // Fecha aba com confirmação
void markDirty(Tab tab, boolean dirty)// Marca como modificado
```

### Detalhes Técnicos
- Suporta arquivos de qualquer tamanho
- Rastreia estado "modificado" (dirty state)
- Mostra asterisco (*) em abas não salvas
- Confirma fechamento se arquivo não foi salvo
- Mantém histórico de arquivos recentes
- Detecção automática de linguagem baseada em extensão

### Efeitos Colaterais
- Arquivos recentes salvos em preferências
- Última posição de cursor por arquivo
- Histórico de Undo/Redo por aba

---

## 2. Syntax Highlighting

### Descrição
Colorização automática de código para múltiplas linguagens.

### Localização
- **Classe Principal:** [SyntaxHighlighter.java](../src/main/java/br/com/corelabs/npsharpfx/backend/engine/editor/SyntaxHighlighter.java)
- **Aplicação:** [EditorManager.java](../src/main/java/br/com/corelabs/npsharpfx/frontend/ui/editor/EditorManager.java)

### Linguagens Suportadas
- Java
- Python
- JavaScript/TypeScript
- C/C++
- HTML/CSS
- XML
- JSON
- YAML
- Markdown
- Bash/Shell
- Portugol (linguagem em português)

### Como Funciona
1. Editor detecta extensão do arquivo
2. Seleciona padrão regex de highlighting correspondente
3. Aplica estilos CSS via `StyleSpans`
4. Atualiza em tempo real durante digitação

### Detalhes Técnicos
- Usa regex para tokenização
- Cache de estilos para performance
- Atualização incremental (apenas linhas alteradas)
- Suporta customização de cores por tema

---

## 3. Gerenciamento de Temas

### Descrição
Sistema completo de temas com suporte a customização visual da interface.

### Localização
- **Classe Principal:** [ThemeManager.java](../src/main/java/br/com/corelabs/npsharpfx/frontend/ui/theme/ThemeManager.java)
- **Registry:** [ThemeRegistry.java](../src/main/java/br/com/corelabs/npsharpfx/frontend/ui/theme/ThemeRegistry.java)
- **Preferências:** [UserPreferences.java](../src/main/java/br/com/corelabs/npsharpfx/frontend/ui/theme/UserPreferences.java)

### Temas Inclusos
20+ temas fornecidos em [src/main/resources/themes/](../src/main/resources/themes/):
- np-dark
- np-light
- Tema Ártico
- Tema Bagre
- Tema Preto OLED
- E mais...

### Como Usar
- Menu Preferences → Theme
- Ou Command Palette → Theme: Select Theme

### Detalhes Técnicos
- Temas em formato JSON (compatível VS Code)
- Cores aplicadas via CSS dinâmico
- Suporta wallpaper customizado
- Controle de opacidade do wallpaper
- Carregamento incremental

### Persistência
- Tema selecionado salvo em `~/.npsharp/settings.json`
- Wallpaper path persistido
- Opacidade customizada persistida

### Efeitos Colaterais
- Interface muda cores imediatamente
- Editor reaplica highlighting com novas cores
- Wallpaper recarregado se especificado

---

## 4. Integração com Git

### Descrição
Controle completo de versão com Git integrado na UI.

### Localização
- **Serviço:** [GitService.java](../src/main/java/br/com/corelabs/npsharpfx/backend/git/GitService.java)
- **UI:** [SourceControlPanel.java](../src/main/java/br/com/corelabs/npsharpfx/frontend/ui/git/SourceControlPanel.java)

### Funcionalidades
1. **Descoberta automática de repositórios** - Encontra todos os .git no workspace
2. **Status em tempo real** - Mostra arquivos modificados, adicionados, deletados
3. **Diff visual** - Exibe diferenças entre versões
4. **Histórico de commits** - Lista commits com autores e datas
5. **Comandos Git** - Executa commit, push, pull, fetch, branch, merge

### Como Usar
- Clique no ícone Source Control (Ctrl+Shift+G)
- Interface mostra repos descobertos
- Clique em arquivo para ver diff
- Digite mensagem de commit e clique commit

### Métodos Relevantes
```java
List<File> discoverRepositories(File workspace)
GitRepositoryStatus readStatus(File repo)
CompletableFuture<List<GitCommit>> historyAsync(File repo)
CompletableFuture<String> diffAsync(File repo, GitFileStatus file)
CompletableFuture<GitOperationResult> runAsync(File repo, String... args)
```

### Status de Arquivos
- `UNTRACKED` - Novo, não rastreado
- `MODIFIED` - Alterado não staged
- `STAGED` - Preparado para commit
- `CONFLICTED` - Em conflito
- `IGNORED` - Ignorado pelo .gitignore

### Efeitos Colaterais
- Commits salvos no repositório
- Histórico local alterado
- Remote sincronizado em push/pull

---

## 5. Debugger Integrado

### Descrição
Suporte a debug de programas em múltiplas linguagens.

### Localização
- **Serviço:** [DebuggerService.java](../src/main/java/br/com/corelabs/npsharpfx/backend/debugger/DebuggerService.java)
- **Processo:** [DebuggerProcess.java](../src/main/java/br/com/corelabs/npsharpfx/backend/runtime/DebuggerProcess.java)

### Funcionalidades
1. **Breakpoints** - Define paradas em linhas específicas
2. **Step Over/Into/Out** - Navegação de execução
3. **Inspeção de Variáveis** - Ver valores de variáveis locais
4. **Stack Trace** - Visualizar pilha de chamadas
5. **Watch Expressions** - Monitorar expressões

### Como Usar
- Clique à esquerda da linha para adicionar breakpoint (ponto vermelho)
- Pressione F5 para iniciar debug
- Use Step Over (F10), Step Into (F11)
- Variáveis aparecem no painel Debug

### Métodos Relevantes
```java
void startDebug(File program, String[] args)
void continue()
void stepOver()
void stepInto()
void stepOut()
Map<String, Object> getVariables()
```

### Suporte de Linguagens
- Java (via JDWP)
- Python (via debugpy)
- Node.js (via V8 inspector)
- Futuros: Go, Rust, C/C++

---

## 6. Terminal Integrado

### Descrição
Terminal de sistema operacional integrado na UI.

### Localização
- **Componente:** [IntegratedTerminalPane.java](../src/main/java/br/com/corelabs/npsharpfx/frontend/ui/terminal/IntegratedTerminalPane.java)
- **Manager (Android):** [TerminalProcessManager.java](../src/main/java/br/com/corelabs/npsharpfx/app/app/src/main/java/br/com/corelabs/npsharpfx/backend/terminal/TerminalProcessManager.java)

### Funcionalidades
1. **Shell nativo** - Bash no Linux/Mac, PowerShell no Windows
2. **Múltiplas abas** - Vários terminais abertos simultaneamente
3. **Histórico** - Setas para cima/baixo no histórico
4. **Diretório de trabalho** - Abre no diretório do workspace
5. **Cores ANSI** - Suporta saída colorida

### Como Usar
- Menu View → Terminal ou Ctrl+`
- Digite comandos normalmente
- Ctrl+C para interromper
- Clique + para nova aba de terminal
- Clique X para fechar aba

### Configurações
```json
{
  "terminalEnabled": true,
  "terminalShellLinux": "/bin/bash",
  "terminalShellWindows": "powershell.exe",
  "terminalInitialDirectory": ""
}
```

### Efeitos Colaterais
- Executa processos em thread separada
- Output renderizado em tempo real
- Alterações de filesystem podem ser detectadas

---

## 7. Busca em Workspace

### Descrição
Busca poderosa de texto em múltiplos arquivos do workspace.

### Localização
- **Serviço:** [WorkspaceSearchService.java](../src/main/java/br/com/corelabs/npsharpfx/backend/engine/search/WorkspaceSearchService.java)
- **UI:** [SearchPane.java](../src/main/java/br/com/corelabs/npsharpfx/frontend/ui/search/SearchPane.java)

### Funcionalidades
1. **Busca por texto** - Literal ou regex
2. **Match case** - Diferenciar maiúsculas/minúsculas
3. **Whole word** - Buscar palavra completa
4. **Processamento paralelo** - Multi-thread para performance
5. **Filtros** - Ignora node_modules, .git, target/, etc.

### Como Usar
- Ctrl+F para busca no arquivo
- Ctrl+Shift+F para busca em workspace
- Digite padrão de busca
- Resultados aparecem em lista
- Clique para navegar

### Configurações de Search
```java
MAX_FILE_SIZE_BYTES = 5 * 1024 * 1024  // 5MB limite
MAX_RESULTS = 5000                      // Máximo resultados
```

### Detalhes Técnicos
- Parallelization via `Stream.parallel()`
- Regex pattern matching
- Ignora arquivos binários
- Cache de resultados

### Efeitos Colaterais
- Nenhum - operação read-only

---

## 8. Gerenciador de Runtimes

### Descrição
Sistema para instalar e gerenciar runtimes de diferentes linguagens.

### Localização
- **Registry:** [RuntimeRegistry.java](../src/main/java/br/com/corelabs/npsharpfx/backend/runtime/RuntimeRegistry.java)
- **Installer:** [RuntimeInstaller.java](../src/main/java/br/com/corelabs/npsharpfx/backend/runtime/RuntimeInstaller.java)

### Runtimes Suportados
- Java
- Python
- Node.js
- Go
- Rust
- C/C++ (GCC, Clang)
- Ruby
- PHP

### Como Funciona
1. **Carregamento:** Aplicação inicia e detecta runtimes instalados
2. **Registry:** Informações salvas em `~/.npsharp/runtime-registry.properties`
3. **Instalação:** Se detectado, adiciona ao registry
4. **Uso:** Debugger e build commands usam runtimes registrados

### Informações por Runtime
```java
LanguageRuntime language   // Linguagem (enum)
Path root                  // Diretório raiz
Path executable            // Caminho do executável
Path debugger              // Debugger (null se não suportado)
String version             // Versão instalada
```

### Persistência
```properties
java.root=/usr/lib/jvm/java-17-openjdk
java.exe=/usr/lib/jvm/java-17-openjdk/bin/java
java.debugger=/path/to/jdwp-agent.jar
java.version=17.0.1

python.root=/usr/bin
python.exe=/usr/bin/python3
python.debugger=/usr/lib/python3/debugpy
python.version=3.11.0
```

---

## 9. Diagnósticos de Código

### Descrição
Análise estática de código com detecção de erros.

### Localização
- **Manager:** [EditorDiagnosticsManager.java](../src/main/java/br/com/corelabs/npsharpfx/frontend/editor/diagnostics/EditorDiagnosticsManager.java)
- **Serviço:** [DiagnosticsService.java](../src/main/java/br/com/corelabs/npsharpfx/frontend/editor/diagnostics/DiagnosticsService.java)
- **Java Runner:** [JavaDiagnosticsRunner.java](../src/main/java/br/com/corelabs/npsharpfx/frontend/editor/diagnostics/JavaDiagnosticsRunner.java)

### Funcionalidades
1. **Error Lens** - Mostra erros inline no editor
2. **Problems Panel** - Lista centralizada de problemas
3. **Auto-compile** - Compilação em background
4. **Severity Levels** - Error, Warning, Information, Hint

### Como Usar
- Abre automático ao editar arquivo Java
- Erros aparecem com ondulado vermelho
- Painel Problems mostra todos os problemas
- Clique para navegar para erro

### Configurações
```json
{
  "diagnosticsEnabled": true,
  "errorLensEnabled": true,
  "compileOnSave": false,
  "problemsAutoOpen": true,
  "buildCommand": "mvn -q -DskipTests compile"
}
```

### Severidades
- `ERROR` - Erro crítico (vermelho)
- `WARNING` - Aviso (amarelo)
- `INFORMATION` - Informação (azul)
- `HINT` - Sugestão (cinza)

---

## 10. Explorador de Arquivos

### Descrição
Visualização hierárquica dos arquivos do workspace.

### Localização
- **Componente:** [FileExplorerPane.java](../src/main/java/br/com/corelabs/npsharpfx/frontend/ui/explorer/FileExplorerPane.java)

### Funcionalidades
1. **Árvore hierárquica** - Pastas e arquivos em tree view
2. **Ícones por tipo** - Diferentes ícones para tipos de arquivo
3. **Duplo clique para abrir** - Abre arquivo em aba
4. **Expansão de pastas** - Navega na hierarquia
5. **Sincronização** - Acompanha arquivo atual no editor

### Como Usar
- Clique no ícone Explorer (Ctrl+Shift+E)
- Duplo clique em arquivo para abrir
- Clique na seta para expandir/colapsar pasta
- Right-click para menu de contexto

### Detalhes Técnicos
- TreeView de JavaFX
- Lazy loading de pastas grandes
- Filtro de arquivos ignorados
- Ícones carregados dinamicamente

---

## 11. Interpretador Portugol

### Descrição
Suporte a programação em linguagem portuguesa (Portugol).

### Localização
- **Lexer:** [Lexer.java](../src/main/java/br/com/corelabs/npsharpfx/backend/portugol/lexer/Lexer.java)
- **Interpretador:** [PortugolInterpreter.java](../src/main/java/br/com/corelabs/npsharpfx/backend/portugol/runtime/PortugolInterpreter.java)

### Funcionalidades
1. **Tokenização** - Converte código Portugol em tokens
2. **Parsing** - Construi AST (Abstract Syntax Tree)
3. **Execução** - Interpreta e executa programa
4. **Variables** - Suporta variáveis com escopos

### Palavras-chave Portugol
- `programa` - Início do programa
- `funcao` - Define função
- `se` - If (condicional)
- `senao` - Else
- `para` - For (loop)
- `enquanto` - While (loop)
- `escreva` - Print/output
- `leia` - Input

### Como Usar
1. Criar arquivo `.por` (Portugol)
2. Escrever código Portugol
3. Executar via Terminal ou Debug
4. Saída aparece no terminal

### Exemplo
```portugol
programa {
  funcao principal() {
    inteiro x = 10
    se (x > 5) {
      escreva("Maior que 5\n")
    }
  }
}
```

---

## 12. Sistema de Arquivos Remoto

### Descrição
Suporte a edição de arquivos em máquinas remotas via SSH.

### Localização
- **Provider:** [RemoteFileSystemProvider.java](../src/main/java/br/com/corelabs/npsharpfx/backend/remote/RemoteFileSystemProvider.java)
- **Serviço:** [RemoteHostService.java](../src/main/java/br/com/corelabs/npsharpfx/backend/remote/RemoteHostService.java)
- **UI:** [RemoteHostPanel.java](../src/main/java/br/com/corelabs/npsharpfx/frontend/ui/remote/RemoteHostPanel.java)

### Funcionalidades
1. **Conexão SSH** - Conecta a hosts remotos
2. **Browse remoto** - Navega filesystem remoto
3. **Edição remota** - Abre/edita arquivos remotos
4. **Terminal remoto** - Shell via SSH
5. **Sincronização** - Cache local de arquivos

### Como Usar
1. Menu Remote → Add Host
2. Configurar hostname, usuário, porta
3. Conectar (usa SSH key ou password)
4. Browser mostra arquivos remotos
5. Duplo clique para abrir e editar

### Configuração de Host
```java
class RemoteHostConfig {
    String hostname
    int port = 22
    String username
    String password  // Ou usar key
    String privateKeyPath
}
```

### Persistência
- Hosts salvos em `~/.npsharp/remote-hosts.json`
- SSH keys buscadas em `~/.ssh/`

---

## 13. Atalhos de Teclado

### Descrição
Sistema customizável de atalhos de teclado.

### Localização
- **Manager:** [ShortcutManager.java](../src/main/java/br/com/corelabs/npsharpfx/frontend/ui/window/shortcuts/ShortcutManager.java)

### Atalhos Principais
| Atalho | Ação |
|--------|------|
| Ctrl+N | Novo arquivo |
| Ctrl+O | Abrir arquivo |
| Ctrl+S | Salvar |
| Ctrl+Shift+S | Salvar como |
| Ctrl+W | Fechar aba |
| Ctrl+` | Toggle terminal |
| Ctrl+F | Buscar no arquivo |
| Ctrl+Shift+F | Buscar workspace |
| Ctrl+Shift+G | Git |
| F5 | Debug |
| F10 | Step over |
| F11 | Step into |
| Ctrl+Shift+E | Explorer |
| Ctrl+Shift+D | Debugger |
| Ctrl+, | Preferences |

### Detalhes Técnicos
- Mapeamento KeyCode → Action
- Intercepta KeyEvent global
- Ações estão em `EditorActions` e `WindowActions`

---

## 14. Configurações e Preferências

### Descrição
Sistema completo de preferências persistidas.

### Localização
- **Settings Class:** [AppSettings.java](../src/main/java/br/com/corelabs/npsharpfx/config/AppSettings.java)
- **Service:** [SettingsService.java](../src/main/java/br/com/corelabs/npsharpfx/config/SettingsService.java)

### Categorias de Configurações
1. **Editor** - Fonte, tamanho, tabs, word wrap, line numbers
2. **Tema** - Tema atual, wallpaper, opacidade
3. **Terminal** - Shell, diretório inicial
4. **Diagnostics** - Compilação, error lens
5. **Compilação** - Comando build, skip tests
6. **UI** - Visibilidade de componentes

### Arquivo de Configuração
```json
{
  "theme": "np-dark",
  "editorFontFamily": "JetBrains Mono",
  "editorFontSize": 14,
  "editorTabSize": 4,
  "editorLineNumbers": true,
  "terminalEnabled": true,
  "diagnosticsEnabled": true,
  "buildCommand": "mvn -q -DskipTests compile"
}
```

### Localização
- `~/.npsharp/settings.json` - Arquivo principal
- `~/.npsharp/runtime-registry.properties` - Runtimes
- `~/.npsharp/wallpapers/` - Wallpapers customizados

---

## 15. Gerenciador de Templates

### Descrição
Templates para criar novos projetos rapidamente.

### Localização
- **Manager:** [TemplateManager.java](../src/main/java/br/com/corelabs/npsharpfx/backend/templates/TemplateManager.java)
- **Recursos:** [src/main/resources/templates/](../src/main/resources/templates/)

### Templates Disponíveis
- Java Project
- Python Project
- Node.js Project
- Web (HTML/CSS/JS)
- C/C++ Project
- Maven Archetype

### Como Usar
- Menu File → New from Template
- Selecionar template
- Configurar nome e localização
- Projeto criado com estrutura base

---

## 16. Ícones Codicon

### Descrição
Sistema de ícones baseado em Codicons do VS Code.

### Localização
- **Manager:** [FileIconManager.java](../src/main/java/br/com/corelabs/npsharpfx/frontend/ui/icons/FileIconManager.java)
- **Codicon Enum:** [Codicon.java](../src/main/java/br/com/corelabs/npsharpfx/frontend/ui/icons/Codicon.java)
- **SVG Loader:** [SvgIconLoader.java](../src/main/java/br/com/corelabs/npsharpfx/frontend/ui/icons/SvgIconLoader.java)

### Funcionalidades
1. **Ícones por extensão** - .java, .py, .js, etc.
2. **Ícones por tipo** - Pasta, arquivo, settings
3. **Ícones de status** - Modified, conflicted, staged
4. **Renderização SVG** - Ícones escaláveis

---

## Resumo

| # | Funcionalidade | Classe Principal | Status |
|---|---|---|---|
| 1 | Editor Multi-aba | EditorManager | ✅ |
| 2 | Syntax Highlighting | SyntaxHighlighter | ✅ |
| 3 | Temas | ThemeManager | ✅ |
| 4 | Git Integration | GitService | ✅ |
| 5 | Debugger | DebuggerService | ✅ |
| 6 | Terminal | IntegratedTerminalPane | ✅ |
| 7 | Busca | WorkspaceSearchService | ✅ |
| 8 | Runtimes | RuntimeRegistry | ✅ |
| 9 | Diagnósticos | EditorDiagnosticsManager | ✅ |
| 10 | Explorer | FileExplorerPane | ✅ |
| 11 | Portugol | PortugolInterpreter | ✅ |
| 12 | Remote FS | RemoteFileSystemProvider | ✅ |
| 13 | Atalhos | ShortcutManager | ✅ |
| 14 | Configurações | SettingsService | ✅ |
| 15 | Templates | TemplateManager | ✅ |
| 16 | Ícones | FileIconManager | ✅ |

---

**Última atualização:** 2026-07-02
