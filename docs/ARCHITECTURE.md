# Arquitetura do NPSharp

## Visão Geral

O NPSharp é um editor de código independente baseado em Java e JavaFX, derivado do VS Code (Code-OSS). A arquitetura é organizada em camadas bem definidas que separam preocupações entre interface, lógica de negócio e serviços de sistema.

```
┌─────────────────────────────────────────────────────────────┐
│                      CAMADA APRESENTAÇÃO                      │
│           (JavaFX - Frontend UI Components)                   │
│  MainWindow, EditorManager, Terminal, Themes, Settings...    │
└─────────────────────────────────────────────────────────────┘
                            ▲
                            │ (depende de)
                            ▼
┌─────────────────────────────────────────────────────────────┐
│               CAMADA DE SERVIÇOS (Backend)                    │
│  Git, Debugger, Themes, Settings, Diagnostics, Search...    │
└─────────────────────────────────────────────────────────────┘
                            ▲
                            │ (depende de)
                            ▼
┌─────────────────────────────────────────────────────────────┐
│              CAMADA DE SISTEMAS/INFRA                        │
│  FileSystem, Runtime Registry, Remote Hosts, Workspace...   │
└─────────────────────────────────────────────────────────────┘
```

## Estrutura de Pacotes

```
br.com.corelabs.npsharpfx/
├── Main.java                          # Ponto de entrada
├── frontend/                          # Camada de apresentação (UI)
│   ├── editor/
│   │   └── diagnostics/              # Diagnósticos de código
│   ├── settings/                      # Tela de configurações
│   ├── ui/
│   │   ├── editor/                   # Editor de código (abas)
│   │   ├── explorer/                 # Explorador de arquivos
│   │   ├── terminal/                 # Terminal integrado
│   │   ├── git/                      # Painel de controle de versão
│   │   ├── search/                   # Busca em workspace
│   │   ├── remote/                   # Hosts remotos (SSH)
│   │   ├── theme/                    # Gerenciador de temas
│   │   ├── window/                   # Layout principal da janela
│   │   └── icons/                    # Ícones (Codicon)
│   └── ui/window/layout/             # Componentes de layout
├── backend/                           # Camada de serviços/lógica
│   ├── git/                          # Git integration
│   ├── debugger/                     # Debugger service
│   ├── filesystem/                   # File system abstractions
│   ├── runtime/                      # Language runtime management
│   ├── templates/                    # Project templates
│   ├── engine/
│   │   ├── editor/                   # Syntax highlighting
│   │   └── search/                   # Workspace search
│   ├── remote/                       # Remote file system & terminal
│   ├── models/                       # Data models
│   └── portugol/                     # Interpretador Portugol
├── config/                            # Configurações
│   ├── AppSettings.java              # Classe de configurações
│   ├── SettingsService.java          # Serviço de persistência
│   └── BuildMode.java                # Modo dev/prod
└── ...
```

## Componentes Principais

### 1. **Main Window (frontend/ui/window/MainWindow.java)**

Orquestra toda a interface gráfica. Responsável por:

- Criar a janela principal (Stage)
- Montar o layout (Activity Bar, Editor, Side Panel, Status Bar)
- Gerenciar reações a eventos (mouse, teclado, janela)
- Coordenar componentes (editor, terminal, search, git, etc.)

**Estrutura Visual:**

```
┌──────────────────────────────────────────┐
│ Title Bar                                │
├─────────┬──────────────────────┬─────────┤
│Activity │ Side Panel           │ Central │
│   Bar   │ (Explorer/Git/etc)   │ Area    │
│         │                      │  (Tabs) │
│         │ EditorManager        │         │
│         │                      │         │
├─────────┼──────────────────────┼─────────┤
│ Terminal / Search / Problems   │ (Abas)  │
├─────────┴──────────────────────┴─────────┤
│ Status Bar                               │
└──────────────────────────────────────────┘
```

### 2. **Editor Manager (frontend/ui/editor/EditorManager.java)**

Gerencia abas, arquivos abertos e conteúdo editorial:

- Controla abertura/fechamento de arquivos
- Gerencia "dirty state" (arquivo modificado)
- Salva arquivos localmente
- Detecta linguagem de programação
- Aplica syntax highlighting
- Rastreia arquivos recentes

**Estrutura Interna:**

```java
Map<File, Tab>           openTabs          // Arquivo -> aba visual
Map<Tab, File>           tabFiles          // Aba visual -> arquivo
Map<Tab, CodeArea>       tabEditors        // Aba -> editor (TextArea)
Map<Tab, Boolean>        tabDirtyState     // Aba -> modificado
Map<Tab, String>         tabLineEndings    // Aba -> LF/CRLF
List<File>               recentFiles       // Histórico
```

### 3. **Theme Manager (frontend/ui/theme/ThemeManager.java)**

Gerencia aparência visual da aplicação:

- Carrega/aplica temas (JSON do VS Code)
- Controla wallpaper e opacidade
- Persiste preferências do usuário
- Gerencia ícones (Codicon)
- Aplica CSS dinâmico

**Fluxo:**

```
UserPreferences (arquivo .npsharp/settings.json)
       ↓
PreferencesManager (carrega)
       ↓
ThemeRegistry (busca tema)
       ↓
EditorTheme (aplica cores)
       ↓
UI atualizada (JavaFX CSS)
```

### 4. **Git Service (backend/git/GitService.java)**

Integração com Git:

- Descobre repositórios no workspace
- Obtém status de alterações
- Executa comandos git (commit, push, pull, etc.)
- Mostra histórico de commits
- Calcula diffs

**Async Pattern:**

Todas as operações retornam `CompletableFuture<T>` para não bloquear UI.

```java
CompletableFuture<List<GitRepositoryStatus>> statusAsync(File workspace)
CompletableFuture<GitOperationResult> runAsync(File repo, String... args)
CompletableFuture<List<GitCommit>> historyAsync(File repo)
```

### 5. **Debugger Service (backend/debugger/DebuggerService.java)**

Suporte a debug de programas:

- Inicia processo de debug
- Gerencia breakpoints
- Permite step over/into/out
- Inspeciona variáveis locais
- Mostra stack trace

### 6. **Runtime Registry (backend/runtime/RuntimeRegistry.java)**

Registro de runtimes instalados:

- Java, Python, Node.js, Go, Rust, C/C++, etc.
- Caminho do executável
- Caminho do debugger
- Versão instalada
- Persistido em `~/.npsharp/runtime-registry.properties`

### 7. **Workspace Search Service (backend/engine/search/WorkspaceSearchService.java)**

Busca em arquivos:

- Busca por regex ou texto literal
- Paralela (multi-thread)
- Filtra arquivos (ignora node_modules, .git, etc.)
- Limite de 5000 resultados
- Máximo 5MB por arquivo

### 8. **File System Abstractions (backend/filesystem/)**

Abstrações para acesso a arquivos:

- `LocalFileSystemProvider` - Sistema de arquivos local
- `RemoteFileSystemProvider` - Arquivos via SSH
- `WorkspaceFileSystemProvider` - Abstração de workspace

### 9. **Settings Service (config/SettingsService.java)**

Persistência de preferências:

- Singleton
- Carrega/salva JSON em `~/.npsharp/settings.json`
- Notifica mudanças via PropertyChangeListener
- Contém: tema, shell do terminal, fontes, tamanho, etc.

## Fluxo de Inicialização

```
1. Main.start(Stage)
   ├── Cria MainWindow
   ├── Inicia thread de extensões (RuntimeInstaller)
   ├── Carrega temas
   ├── Carrega preferências do usuário
   └── Mostra janela
       ├── Cria Activity Bar
       ├── Cria Editor Manager
       ├── Cria File Explorer
       ├── Cria Terminal Integrado
       ├── Cria Search Pane
       ├── Cria Source Control Panel
       └── Aplica último tema usado
```

## Padrões e Convenções

### Observer Pattern
- `PropertyChangeSupport` para notificações de mudança
- `UserPreferences.addListener()` para observar temas

### Singleton Pattern
- `SettingsService.getInstance()`
- `ThemeManager` (uma instância por aplicação)

### Executor Service Pattern
- `GitService` usa `ExecutorService` para operações async
- Evita bloqueio da UI

### MVC Pattern
- Model: Classes em `models/` e `config/`
- View: Classes em `frontend/ui/`
- Controller: Classes em `backend/` (serviços)

## Persistência de Dados

### Arquivos do Usuário
```
~/.npsharp/
├── settings.json              # Preferências do app
├── runtime-registry.properties # Runtimes instalados
├── wallpapers/                # Wallpapers customizados
├── themes/                    # Temas customizados
└── ...
```

## Dependências Externas

### JavaFX
- Versão: 21.0.2
- Módulos: controls, graphics, swing, media
- Usado para toda interface gráfica

### RichTextFX
- Versão: 0.11.3
- Usado para CodeArea (editor com syntax highlighting)

### Gson
- Versão: 2.11.0
- Parsing de JSON (temas, settings)

### JSch
- Versão: 0.1.55
- SSH para remote file system

### Batik
- Versão: 1.17
- Conversão de SVG para imagens

## Decisões Arquiteturais

### Por que JavaFX?
- Framework UI nativo para Java
- Suporte a CSS
- Bom desempenho para desktop
- Cross-platform (Windows, Linux, macOS)

### Por que Maven?
- Build reproducível
- Gerenciamento de dependências
- Integração com CI/CD

### Por que async/CompletableFuture?
- Evita bloqueio de UI
- Operações como Git podem ser lentas
- Melhor responsividade

### Por que singletons para serviços?
- Uma única instância por aplicação
- Fácil acesso global
- Estado centralizado

## Extensibilidade

O sistema permite:

- Novos temas (JSON + CSS)
- Novos runtimes (RuntimeRegistry)
- Novos file systems (provider pattern)
- Novos dialetos de linguagem (Portugol interpreter)

Futuro: Plugin architecture para extensões de terceiros.

---

**Última atualização:** 2026-07-02
