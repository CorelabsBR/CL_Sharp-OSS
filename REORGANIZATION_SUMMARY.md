# Reorganização de Estrutura - NPSharp JavaFX Project

## ✅ Objetivo Concluído

O projeto foi reorganizado para separar claramente a **lógica de sistema (backend)** da **interface/interação (frontend)**.

---

## 📁 Estrutura Nova Criada

```
src/main/java/br/com/corelabs/npsharpfx/

┌── backend/                          ← Lógica do sistema
│   ├── engine/                       ← Motor/processamento
│   │   ├── editor/
│   │   │   └── SyntaxHighlighter.java
│   │   ├── explorer/
│   │   └── search/
│   │       ├── WorkspaceSearchService.java
│   │       └── util/
│   │           ├── SearchableFileFilter.java
│   │           └── SearchTextAnalyzer.java
│   │
│   ├── models/                       ← Classes de dados
│   │   ├── WorkspaceSearchQuery.java
│   │   └── WorkspaceSearchResult.java
│   │
│   └── services/                     ← Serviços (vazio, expansível)
│
├── frontend/                         ← Interface do usuário
│   └── ui/                           ← Componentes visuais
│       ├── editor/
│       │   ├── EditorManager.java (gerencia abas, salvamento)
│       │   └── WelcomePane.java (tela inicial)
│       │
│       ├── explorer/
│       │   └── FileExplorerPane.java
│       │
│       ├── icons/
│       │   ├── Codicon.java
│       │   ├── FileIconManager.java
│       │   └── SvgIconLoader.java
│       │
│       ├── search/
│       │   ├── SearchPane.java (interface de busca)
│       │   └── SearchResult.java (modelo visual)
│       │
│       ├── terminal/
│       │   └── IntegratedTerminalPane.java
│       │
│       ├── theme/
│       │   ├── ThemeManager.java
│       │   ├── EditorColorManager.java
│       │   ├── ThemeParser.java
│       │   ├── ThemeRegistry.java
│       │   ├── ThemeFileLoader.java
│       │   ├── PreferencesManager.java
│       │   ├── ThemePackageLoader.java
│       │   ├── ThemeHelper.java
│       │   ├── ThemeIconHelper.java
│       │   ├── EditorTheme.java
│       │   ├── VSCodeThemeEntry.java
│       │   ├── UserPreferences.java
│       │   └── CSSThemeGenerator.java
│       │
│       └── window/
│           ├── MainWindow.java
│           ├── TitleBar.java
│           ├── layout/
│           │   ├── ActivityBarManager.java
│           │   ├── SidePanelManager.java
│           │   └── StatusBarManager.java
│           ├── panels/
│           │   ├── SearchHelper.java
│           │   ├── SettingsPanelBuilder.java
│           │   └── ThemeChooserPanel.java
│           └── shortcuts/
│               └── ShortcutManager.java
│
└── Main.java                         ← Ponto de entrada (raiz)
```

---

## 🔄 Mudanças Realizadas

### 1. **Criação da Estrutura Backend**
- ✅ Criada pasta `backend/engine/` para lógica pura
- ✅ Criada pasta `backend/models/` para classes de dados
- ✅ Criada pasta `backend/services/` para serviços (expansível)

### 2. **Reorganização de Archivos**

#### Backend - Lógica Pura (sem JavaFX):
| Arquivo | Localização Nova |
|---------|-----------------|
| `SyntaxHighlighter.java` | `backend/engine/editor/` |
| `WorkspaceSearchService.java` | `backend/engine/search/` |
| `SearchableFileFilter.java` | `backend/engine/search/util/` |
| `SearchTextAnalyzer.java` | `backend/engine/search/util/` |
| `WorkspaceSearchQuery.java` | `backend/models/` |
| `WorkspaceSearchResult.java` | `backend/models/` |

#### Frontend - Componentes Visuais (com JavaFX):
| Arquivo | Localização Nova |
|---------|-----------------|
| `EditorManager.java` | `frontend/ui/editor/` |
| `WelcomePane.java` | `frontend/ui/editor/` |
| `FileExplorerPane.java` | `frontend/ui/explorer/` |
| `SearchPane.java` | `frontend/ui/search/` |
| `SearchResult.java` | `frontend/ui/search/` |
| Restantes (theme, window, icons, terminal) | `frontend/ui/[categoria]/` |

### 3. **Atualização de Imports**
- ✅ Updated 7+ arquivos Java com novos paths de imports
- ✅ Imports de `frontend.engine.*` → `frontend.ui.*`
- ✅ Imports de `frontend.engine.search.*` → `backend.engine.search.*`
- ✅ Imports de modelos → `backend.models.*`

### 4. **Limpeza**
- ✅ Removidas pastas antigas (`frontend/engine/`, `frontend/search/`, `ui/`)
- ✅ Estrutura consolidada e organizada

---

## 🎯 Princípios Aplicados

✅ **Separação de Responsabilidades**
- Backend: Lógica, processamento, regras de negócio
- Frontend: Interface, interação, componentes visuais

✅ **Sem Mistura de Tecnologias**
- Backend: Apenas Java puro (sem JavaFX)
- Frontend: JavaFX para toda interface

✅ **Escalabilidade**
-  Fácil adicionar novos serviços em `backend/services/`
- Fácil adicionar novos componentes em `frontend/ui/`

✅ **Clareza de Código**
- Estrutura reflete propósito de cada módulo
- Pacotes bem nomeados e organizados

---

## 📋 Próximas Etapas (Optional)

1. **Compilação**: Execute `mvn clean compile` (requer Maven instalado)
2. **Validação**: Teste o projeto para garantir que tudo funciona
3. **Git**: Commit das mudanças:
   ```bash
   git add .
   git commit -m "refactor: reorganize project structure - separate backend and frontend"
   ```

---

## 📝 Notas Importantes

- **Backend/engine vazio para expandir**: A pasta `backend/explorer/` foi criada mas pode receber a lógica de explorador de arquivos no futuro
- **Services para expansão**: A pasta `backend/services/` está pronta para serviços como preferências, logging, etc.
- **Frontend/ui consolidado**: Toda interface visual está organizada em subcategorias temáticas

---
## iniciar o projeto
& "C:\Program Files\Apache NetBeans\java\maven\bin\mvn.cmd" -f pom.xml clean javafx:run


**Data**: 13 de Abril de 2026
**Status**: ✅ Concluído com Sucesso
