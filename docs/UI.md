# Interface (UI) do NPSharp

## Visão Geral

A interface do NPSharp é baseada em JavaFX e segue o design do Visual Studio Code. A estrutura é modular e segue padrão MVC.

## Estrutura Visual Principal

```
┌─────────────────────────────────────────────────────────────┐
│ Title Bar (Janela)                                          │
├──────────┬───────────────────────────────┬─────────────────┤
│ Activity │ Side Panel                    │ Central Editor  │
│   Bar    │ (Explorer/Git/Search/etc)    │                 │
│ (icons)  │                               │ ┌─────────────┐│
│          │ • File Explorer               │ │ Editor Tabs ││
│          │ • Source Control              │ ├─────────────┤│
│          │ • Search                      │ │ Code Editor ││
│          │ • Remote Hosts                │ │ (CodeArea)  ││
│          │ • Settings                    │ │             ││
│          │ • Extensions                  │ │             ││
│          │                               │ │             ││
├──────────┼───────────────────────────────┼─────────────────┤
│ Terminal / Search Results / Problems Panel (Abas)         │
├──────────┴───────────────────────────────┴─────────────────┤
│ Status Bar (Informações, Encoding, Line endings, etc)    │
└──────────────────────────────────────────────────────────────┘
```

## Componentes Principais

### 1. MainWindow (frontend/ui/window/MainWindow.java)

**Classe Principal:** [MainWindow.java](../src/main/java/br/com/corelabs/npsharpfx/frontend/ui/window/MainWindow.java)

Orquestra toda a interface. Responsável por:

- Criar Stage (janela)
- Montar BorderPane principal
- Gerenciar Activity Bar
- Gerenciar Side Panel
- Gerenciar Editor Area
- Gerenciar Terminal/Problems/Search Panel
- Gerenciar Status Bar
- Carregar temas
- Gerenciar atalhos

**Dimensões Padrão:**
```java
DEFAULT_WIDTH = 900      // Largura mínima
DEFAULT_HEIGHT = 560     // Altura mínima
MIN_WIDTH = 800          // Não redimensiona abaixo
MIN_HEIGHT = 520         // Não redimensiona abaixo
```

### 2. Activity Bar (frontend/ui/window/layout/ActivityBarManager.java)

**Localização:** Esquerda vertical

**Função:** Navegação entre painéis principais

**Botões/Ícones:**
```
┌─────────┐
│ Explorer│  (Ctrl+Shift+E)
├─────────┤
│ Search  │  (Ctrl+Shift+F)
├─────────┤
│  Git    │  (Ctrl+Shift+G)
├─────────┤
│Debug    │  (Ctrl+Shift+D)
├─────────┤
│Terminal │  (Ctrl+`)
├─────────┤
│ Settings│  (Ctrl+,)
├─────────┤
│Remote   │  SSH
└─────────┘
```

**Implementação:**
```java
enum ActivityItem {
    EXPLORER, SEARCH, SOURCE_CONTROL, DEBUG,
    REMOTE, EXTENSIONS, SETTINGS
}
```

### 3. Side Panel (frontend/ui/window/layout/SidePanelManager.java)

**Localização:** Esquerda, abaixo da Activity Bar

**Função:** Mostra conteúdo do painel selecionado

**Painéis Disponíveis:**

#### File Explorer
- **Classe:** [FileExplorerPane.java](../src/main/java/br/com/corelabs/npsharpfx/frontend/ui/explorer/FileExplorerPane.java)
- **Componente:** TreeView com arquivos/pastas
- **Ações:** Duplo clique = abrir arquivo
- **Ícones:** Por tipo de arquivo

#### Source Control
- **Classe:** [SourceControlPanel.java](../src/main/java/br/com/corelabs/npsharpfx/frontend/ui/git/SourceControlPanel.java)
- **Componente:** TreeView com repos e status
- **Ações:** Ver diff, fazer commit, push/pull
- **Status:** Untracked, Modified, Staged, Conflicted

#### Search
- **Classe:** [SearchPane.java](../src/main/java/br/com/corelabs/npsharpfx/frontend/ui/search/SearchPane.java)
- **Componente:** TextField + ListView de resultados
- **Ações:** Regex, case sensitivity, whole word
- **Função:** Busca em todo workspace

#### Remote Hosts
- **Classe:** [RemoteHostPanel.java](../src/main/java/br/com/corelabs/npsharpfx/frontend/ui/remote/RemoteHostPanel.java)
- **Função:** Conectar via SSH
- **Ações:** Browse remoto, editar arquivos

#### Settings
- **Classe:** [SettingsView.java](../src/main/java/br/com/corelabs/npsharpfx/frontend/settings/SettingsView.java)
- **Função:** Interface gráfica de configurações
- **Categorias:** Editor, Terminal, Themes, Diagnostics

### 4. Editor Area (frontend/ui/editor/EditorManager.java)

**Localização:** Centro

**Função:** Editor de código com múltiplas abas

**Estrutura:**
```
┌─────────────────────────────────┐
│ File1.java │ File2.py │ File3 ✕ │  <- TabPane (abas)
├─────────────────────────────────┤
│                                 │
│ ┌─────────────────────────────┐ │
│ │ 1  | package br.com...      │ │
│ │ 2  | import java.util.*;   │ │
│ │ 3  |                       │ │  <- CodeArea (editor)
│ │ 4  | public class Main {   │ │  - RichTextFX
│ │ 5  |   ...                 │ │  - Syntax highlighting
│ │    |                       │ │  - Line numbers
│ └─────────────────────────────┘ │
│                                 │
└─────────────────────────────────┘
```

**Componentes:**
- **TabPane** - Container de abas
- **CodeArea** (RichTextFX) - Editor com highlighting
- **ScrollPane** - Scroll vertical/horizontal
- **LineNumberingPane** - Números de linha (esquerda)

**Recursos:**
- Syntax Highlighting por linguagem
- Números de linha
- Detecção de dirty state (arquivo modificado)
- Undo/Redo
- Find/Replace
- Code folding (futuro)

### 5. Terminal Panel (frontend/ui/terminal/IntegratedTerminalPane.java)

**Localização:** Parte inferior (variável altura)

**Função:** Shell integrado

**Abas:**
- Terminal (1, 2, 3, ...)
- Problems
- Debug Console

**Componentes:**
- **TextField** - Entrada de comando
- **TextArea** - Output de terminal
- **ProcessBuilder** - Executa processo shell
- **AnsiTerminalRenderer** - Renderiza cores ANSI

**Comportamento:**
- Altura redimensionável
- Pode ser minimizado (collapse)
- Múltiplas abas de terminal
- Histórico de comandos (setas)

### 6. Status Bar (frontend/ui/window/layout/StatusBarManager.java)

**Localização:** Parte inferior (fixa)

**Função:** Informações gerais

**Indicadores:**
```
[Modo] | Arquivo.java | Lin 45, Col 12 | UTF-8 | CRLF | Linguagem
```

| Item | Exemplo | Função |
|------|---------|--------|
| Modo | [DEV] | Desenvolvimento ou Production |
| Arquivo | Main.java | Nome do arquivo atual |
| Posição | Lin 45, Col 12 | Linha e coluna do cursor |
| Encoding | UTF-8 | Codificação do arquivo |
| Line Ending | LF / CRLF | Tipo de quebra de linha |
| Linguagem | Java | Linguagem detectada |

### 7. Tema e Estilo (frontend/ui/theme/)

**Arquivos CSS:**
- [app.css](../src/main/resources/css/app.css) - Estilos gerais
- [editor.css](../src/main/resources/css/editor.css) - Editor específico

**Cores Definidas por Tema:**
```json
{
  "editor.background": "#1e1e1e",
  "editor.foreground": "#d4d4d4",
  "editor.lineNumberForeground": "#858585",
  "editorCursor.foreground": "#aeafad",
  ...
}
```

**Sistema de Temas:**
1. Arquivo JSON em `src/main/resources/themes/`
2. Loader: `ThemeFileLoader`
3. Aplicador: `CSSThemeGenerator`
4. Runtime: `ThemeManager` aplica via CSS dinâmico

### 8. Ícones (frontend/ui/icons/)

**Sistema de Ícones:**
- **Codicons** - Ícones do VS Code (SVG)
- **Formato** - SVG (escalável, colorido)
- **Dinâmico** - Cores aplicadas pelo tema

**Classes:**
- [Codicon.java](../src/main/java/br/com/corelabs/npsharpfx/frontend/ui/icons/Codicon.java) - Enum de ícones
- [SvgIconLoader.java](../src/main/java/br/com/corelabs/npsharpfx/frontend/ui/icons/SvgIconLoader.java) - Carregador SVG
- [FileIconManager.java](../src/main/java/br/com/corelabs/npsharpfx/frontend/ui/icons/FileIconManager.java) - Ícones por tipo

**Ícones por Arquivo:**
```java
// Detecção por extensão
.java    -> Ícone Java
.py      -> Ícone Python
.js      -> Ícone JavaScript
.json    -> Ícone JSON
.xml     -> Ícone XML
.txt     -> Ícone Documento
.folder  -> Ícone Pasta
```

## Recursos Gráficos

### Wallpapers
**Localização:** [src/main/resources/wallpapers/](../src/main/resources/) ou `~/.npsharp/wallpapers/`

**Características:**
- Extensão: PNG, JPG, GIF
- Opacidade: 0.0 (transparente) a 1.0 (opaco)
- Renderização: BackgroundImage com repeat settings
- Cache: Compilado no primeiro uso

### Temas
**Localização:** [src/main/resources/themes/](../src/main/resources/themes/)

**Arquivo:** 20+ temas JSON

**Exemplo:** [nps_dark.json](../src/main/resources/themes/nps_dark.json)

**Estrutura Tema:**
```json
{
  "name": "NPSharp Dark",
  "type": "dark",
  "colors": {
    "editor.background": "#1e1e1e",
    "editor.foreground": "#d4d4d4",
    "button.background": "#0e639c",
    ...
  },
  "tokenColors": [
    {
      "name": "Comment",
      "scope": "comment",
      "settings": {"foreground": "#6a9955"}
    },
    ...
  ]
}
```

## Interações e Comportamentos

### Teclado

**Atalhos Globais:**

| Atalho | Ação |
|--------|------|
| Ctrl+N | Novo arquivo |
| Ctrl+O | Abrir arquivo |
| Ctrl+S | Salvar |
| Ctrl+Shift+S | Salvar como |
| Ctrl+W | Fechar aba |
| Ctrl+` | Toggle terminal |
| Ctrl+F | Find no arquivo |
| Ctrl+H | Find/Replace |
| Ctrl+Shift+F | Find workspace |
| Ctrl+Shift+G | Git |
| Ctrl+Shift+E | Explorer |
| F5 | Debug |
| F10 | Step over |
| F11 | Step into |
| Ctrl+, | Settings |

**Implementação:** [ShortcutManager.java](../src/main/java/br/com/corelabs/npsharpfx/frontend/ui/window/shortcuts/ShortcutManager.java)

### Mouse

**Duplo clique:**
- Arquivo no explorer → Abre em aba
- Palavra no editor → Seleciona palavra
- Dobra na gutter → Expande/colaba

**Clique direito:**
- Arquivo → Menu contexto (rename, delete, copy path)
- Código → Menu editor (cut, copy, paste)

**Scroll:**
- Editor → Scroll vertical/horizontal
- MouseWheel + Ctrl → Zoom editor

### Animações

**Transições Suaves:**
- Abertura/fechamento de painéis
- Alternância de temas (fade)
- Redimensionamento de terminal

**Implementação:** [VSCodeLayoutAnimator.java](../src/main/java/br/com/corelabs/npsharpfx/frontend/ui/window/layout/VSCodeLayoutAnimator.java)

## Tela de Boas-vindas

**Classe:** [WelcomePane.java](../src/main/java/br/com/corelabs/npsharpfx/frontend/ui/editor/WelcomePane.java)

**Exibida quando:** Sem abas abertas

**Conteúdo:**
- Logo NPSharp
- Links rápidos (Open folder, Create file)
- Atalhos úteis
- Links documentação

## Diagnostic Rendering

**Classe:** [ErrorLensRenderer.java](../src/main/java/br/com/corelabs/npsharpfx/frontend/editor/diagnostics/ErrorLensRenderer.java)

**Mostra:**
- Erros inline no editor (linha com ondulado vermelho)
- Mensagem de erro em tooltip
- Ícone de erro na gutter

**Severidades:**
- 🔴 ERROR
- 🟡 WARNING
- 🔵 INFORMATION
- ⚫ HINT

## Respon Style

A interface responde a:
- **Redimensionamento:** Componentes reflow automático
- **Minimização/Maximização:** Salvo estado
- **Mudança de tema:** Aplicado em runtime sem reload
- **Mudança de settings:** Muitos refletem instantaneamente

## Future Enhancements (UI)

Potenciais melhorias não implementadas:

- [ ] Minimap (vista prévia do arquivo)
- [ ] Code folding visual
- [ ] Breadcrumbs (navegação de arquivo)
- [ ] Preview ao lado (split view)
- [ ] Zen mode (full editor)
- [ ] Custom keybindings UI
- [ ] Marketplace de temas (UI)
- [ ] Extensions sidebar visual

---

**Última atualização:** 2026-07-02
