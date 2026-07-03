# Configuração do NPSharp

## Visão Geral

O NPSharp armazena todas as configurações em arquivos JSON no diretório home do usuário. Todas as preferências são carregadas ao iniciar e salvos em tempo real.

## Localização dos Arquivos

### Diretório Principal
```
~/.npsharp/                               # Diretório root
├── settings.json                         # Configurações principais
├── runtime-registry.properties           # Runtimes instalados
├── wallpapers/                           # Wallpapers customizados
├── themes/                               # Temas customizados
├── icons/                                # Ícones customizados
└── recent-files.json                     # Histórico de arquivos
```

## Arquivo: settings.json

### Localização
`~/.npsharp/settings.json`

### Estrutura Completa
```json
{
  "theme": "np-dark",
  "iconTheme": "default",
  "iconColor": "",
  "wallpaperPath": "",
  "wallpaperOpacity": 0.18,
  
  "editorFontFamily": "JetBrains Mono",
  "editorFontSize": 14,
  "editorTabSize": 4,
  "editorWordWrap": false,
  "editorLineNumbers": true,
  "editorAutoSave": false,
  "editorFormatOnSave": false,
  
  "terminalEnabled": true,
  "terminalShellLinux": "/bin/bash",
  "terminalShellWindows": "powershell.exe",
  "terminalInitialDirectory": "",
  
  "diagnosticsEnabled": true,
  "errorLensEnabled": true,
  "compileOnSave": false,
  "problemsAutoOpen": true,
  
  "buildCommand": "mvn -q -DskipTests compile",
  "buildSkipTests": true,
  
  "statusBarVisible": true,
  "activityBarVisible": true,
  "sideBarVisible": true
}
```

### Configurações por Categoria

#### 📝 Editor

| Configuração | Tipo | Padrão | Descrição |
|---|---|---|---|
| `editorFontFamily` | string | "JetBrains Mono" | Fonte do editor |
| `editorFontSize` | int | 14 | Tamanho em pixels |
| `editorTabSize` | int | 4 | Espaços por tab |
| `editorWordWrap` | bool | false | Quebra de linha automática |
| `editorLineNumbers` | bool | true | Mostra números de linha |
| `editorAutoSave` | bool | false | Salva automaticamente |
| `editorFormatOnSave` | bool | false | Formata ao salvar |

**Como Alterar:**
```bash
# Aumentar tamanho de fonte
vi ~/.npsharp/settings.json
# Altere "editorFontSize": 14 para 16
# Reinicie o NPSharp
```

**Efeitos:**
- Mudanças aplicadas ao reiniciar
- Arquivo monitorado para mudanças
- Revert se JSON inválido

#### 🎨 Tema

| Configuração | Tipo | Padrão | Descrição |
|---|---|---|---|
| `theme` | string | "np-dark" | Nome do tema ativo |
| `iconTheme` | string | "default" | Tema de ícones |
| `iconColor` | string | "" | Cor dos ícones (override) |
| `wallpaperPath` | string | "" | Caminho para wallpaper customizado |
| `wallpaperOpacity` | double | 0.18 | Opacidade (0.0-1.0) |

**Temas Disponíveis:**
- `np-dark` (padrão)
- `np-light`
- `np-arkticheskiy_stal`
- `np-bagroviy_ekran`
- `np-chornaya_doska_oled`
- E mais 15+ temas...

**Como Alterar Tema:**
```bash
# Via UI
Preferences → Theme → Selecionar tema

# Via JSON
vi ~/.npsharp/settings.json
# Altere "theme": "np-dark" para "theme": "np-light"
```

**Adicionar Wallpaper:**
```bash
vi ~/.npsharp/settings.json
# Altere:
# "wallpaperPath": "/caminho/para/imagem.png"
# "wallpaperOpacity": 0.3  # 30% opaco
```

**Wallpapers Suportados:**
- PNG
- JPG/JPEG
- GIF
- BMP

#### 🖥️ Terminal

| Configuração | Tipo | Padrão | Descrição |
|---|---|---|---|
| `terminalEnabled` | bool | true | Terminal integrado ativado |
| `terminalShellLinux` | string | "/bin/bash" | Shell no Linux |
| `terminalShellWindows` | string | "powershell.exe" | Shell no Windows |
| `terminalInitialDirectory` | string | "" | Diretório inicial (vazio = workspace) |

**Como Alterar Shell:**
```bash
# Usar Zsh no Linux
vi ~/.npsharp/settings.json
# Altere: "terminalShellLinux": "/bin/zsh"

# Usar CMD no Windows
# Altere: "terminalShellWindows": "cmd.exe"
```

**Shells Disponíveis:**
- Linux: `/bin/bash`, `/bin/zsh`, `/bin/sh`
- Windows: `powershell.exe`, `cmd.exe`, `pwsh.exe`
- macOS: `/bin/bash`, `/bin/zsh`, `/bin/sh`

#### 🔍 Diagnósticos

| Configuração | Tipo | Padrão | Descrição |
|---|---|---|---|
| `diagnosticsEnabled` | bool | true | Análise de código ativa |
| `errorLensEnabled` | bool | true | Mostra erros inline |
| `compileOnSave` | bool | false | Compila ao salvar |
| `problemsAutoOpen` | bool | true | Abre painel de problemas |

**Comando de Build:**

| Configuração | Tipo | Padrão | Descrição |
|---|---|---|---|
| `buildCommand` | string | "mvn -q -DskipTests compile" | Comando para compilar |
| `buildSkipTests` | bool | true | Pula testes |

**Como Customizar Comando de Build:**
```bash
# Para Gradle
"buildCommand": "gradle build -x test"

# Para Maven com tests
"buildCommand": "mvn clean compile"
"buildSkipTests": false

# Para Node.js
"buildCommand": "npm run build"
```

#### 📊 UI (Interface)

| Configuração | Tipo | Padrão | Descrição |
|---|---|---|---|
| `statusBarVisible` | bool | true | Status bar visível |
| `activityBarVisible` | bool | true | Activity bar visível |
| `sideBarVisible` | bool | true | Side panel visível |

**Como Ocultar Componentes:**
```bash
vi ~/.npsharp/settings.json
# Ocultar status bar: "statusBarVisible": false
# Ocultar activity bar: "activityBarVisible": false
```

## Arquivo: runtime-registry.properties

### Localização
`~/.npsharp/runtime-registry.properties`

### Formato
```properties
# Java
java.root=/usr/lib/jvm/java-17-openjdk
java.exe=/usr/lib/jvm/java-17-openjdk/bin/java
java.debugger=/path/to/jdwp-agent.jar
java.version=17.0.1

# Python
python.root=/usr/bin
python.exe=/usr/bin/python3
python.debugger=/usr/lib/python3/debugpy
python.version=3.11.0

# Node.js
nodejs.root=/usr/local/node
nodejs.exe=/usr/local/node/bin/node
nodejs.debugger=/usr/local/node/lib/node_modules/debug
nodejs.version=18.16.0

# Go
go.root=/usr/local/go
go.exe=/usr/local/go/bin/go
go.debugger=/usr/local/go/bin/dlv
go.version=1.20.0
```

### Como Adicionar Runtime Manualmente

Se um runtime não foi detectado automaticamente:

```bash
vi ~/.npsharp/runtime-registry.properties

# Adicione (exemplo Python):
python.root=/usr/bin
python.exe=/usr/bin/python3
python.debugger=/usr/local/lib/python3.11/site-packages/debugpy
python.version=3.11.0
```

## Arquivo: recent-files.json

### Localização
`~/.npsharp/recent-files.json`

### Estrutura
```json
{
  "recentFiles": [
    "/home/usuario/projeto/Main.java",
    "/home/usuario/projeto/config.json",
    "/home/usuario/projeto/README.md"
  ],
  "lastOpenedWorkspace": "/home/usuario/projeto"
}
```

### Limpeza
```bash
# Limpar histórico
rm ~/.npsharp/recent-files.json
```

## Preferências por Contexto

### Preferências Globais
Aplicam a toda aplicação, salvos em `settings.json`.

### Preferências por Arquivo
Algumas configurações são detectadas por arquivo:
- **Line Endings** (LF/CRLF) - Detectado automaticamente
- **Encoding** - UTF-8 é padrão, outros detectados
- **Linguagem** - Detectada por extensão

## Sistema de Defaults

### Quando NPSharp é Iniciado pela Primeira Vez

1. Verifica se `~/.npsharp/` existe
2. Se não, cria diretório
3. Cria `settings.json` com valores padrão
4. Carrega temas disponíveis
5. Detecta runtimes instalados

### Valores Padrão (AppSettings.java)
```java
public class AppSettings {
    public String theme = "np-dark";
    public String iconTheme = "default";
    public String editorFontFamily = "JetBrains Mono";
    public int editorFontSize = 14;
    public int editorTabSize = 4;
    // ... (veja arquivo para lista completa)
}
```

## Cache

### Diretórios de Cache
```
~/.npsharp/
├── cache/                    # Cache geral
│   ├── icons/               # Ícones renderizados
│   ├── themes/              # Temas compilados
│   └── search/              # Índice de busca
```

### Limpeza de Cache
```bash
# Limpar tudo (mantém settings)
rm -rf ~/.npsharp/cache/

# NPSharp recriará ao reiniciar
```

## Alterações em Runtime

### Método Observador
```java
// Adicionar listener
SettingsService.getInstance().getSettings()
    .addPropertyChangeListener("theme", event -> {
        // tema mudou para: event.getNewValue()
    });
```

## Troubleshooting

### Problema: Configurações não salvam
**Solução:**
```bash
# Verificar permissões
ls -la ~/.npsharp/settings.json

# Se necessário, corrigir
chmod 644 ~/.npsharp/settings.json
```

### Problema: JSON inválido em settings
**Solução:**
```bash
# Restaurar padrão
rm ~/.npsharp/settings.json
# NPSharp recriará ao reiniciar
```

### Problema: Shell do terminal não funciona
**Solução:**
```bash
# Verificar shell disponível
which bash  # ou zsh, fish, etc

# Atualizar settings.json com shell válido
vi ~/.npsharp/settings.json
# Altere terminalShellLinux para caminho correto
```

## Variáveis de Ambiente

O NPSharp respeita algumas variáveis de ambiente:

| Variável | Efeito |
|---|---|
| `JAVA_HOME` | Usado para detectar Java |
| `PYTHON_PATH` | Caminho adicional para Python |
| `NODE_PATH` | Caminho adicional para Node.js |
| `PATH` | Busca executáveis para runtimes |

## Migration de Configurações

### De Versão Anterior

Se você tem uma versão antiga:
```bash
# Copiar settings antigos
cp ~/.npsharp_old/settings.json ~/.npsharp/settings.json

# Verificar compatibilidade
# (a estrutura é compatível entre versões)
```

## Exemplo de Workflow: Customizar Setup Completo

```bash
# 1. Criar diretório
mkdir -p ~/.npsharp/wallpapers

# 2. Copiar wallpaper
cp ~/meu-wallpaper.png ~/.npsharp/wallpapers/

# 3. Editar settings
cat > ~/.npsharp/settings.json << 'EOF'
{
  "theme": "np-light",
  "wallpaperPath": "/home/usuario/.npsharp/wallpapers/meu-wallpaper.png",
  "wallpaperOpacity": 0.25,
  "editorFontFamily": "Fira Code",
  "editorFontSize": 16,
  "editorTabSize": 2,
  "terminalShellLinux": "/bin/zsh",
  "buildCommand": "npm run build",
  "diagnosticsEnabled": true
}
EOF

# 4. Reiniciar NPSharp
# Novas configurações aplicadas
```

---

**Última atualização:** 2026-07-02
