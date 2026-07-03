# NPSharp – Editor de Código Aberto e Independente

[![Feature Requests](https://img.shields.io/github/issues/girellidev/npsharp/feature-request.svg)](https://github.com/girellidev/npsharp/issues?q=is%3Aopen+is%3Aissue+label%3Aaprimoramento+sort%3Areactions-%2B1-desc)
[![Bugs](https://img.shields.io/github/issues/girellidev/npsharp/bug.svg)](https://github.com/girellidev/npsharp/issues?utf8=✓&q=is%3Aissue+is%3Aopen+label%3Abug)
[![NPSharp Constructor](https://github.com/CorelabsBR/CL_NPSharp/actions/workflows/autochecker.yml/badge.svg)](https://github.com/CorelabsBR/CL_NPSharp/actions/workflows/autochecker.yml)

[NPSharp](https://npsharp.corelabs.dev.br) é distribuído sob uma [Licença Proprietária Corelabs](https://npsharp.corelabs.dev.br/license/)

## O que é NPSharp?

**NPSharp** é um editor de código independente, construído em Java com JavaFX, que reúne as melhores funcionalidades do Visual Studio Code — sem telemetria, sem coleta escondida, sem travas.

É a experiência completa do editor moderno, construída para desenvolvedores de verdade que querem **controle total** da ferramenta que usam todos os dias.

**NPSharp é atualizado mensalmente** com novas funcionalidades e correções. Você pode baixá-lo em Windows, macOS e Linux no [site oficial](https://npsharp.corelabs.dev.br#download).

---

## 🚀 Principais Recursos

- ✨ **Editor moderno** - Syntax highlighting para 15+ linguagens
- 🔌 **Terminal integrado** - Bash, PowerShell, Zsh com suporte a cores ANSI
- 🌳 **Explorador de arquivos** - Navegação com ícones por tipo
- 🐙 **Git integrado** - Status, commit, push, pull, diff, histórico
- 🔍 **Busca poderosa** - Regex, workspace, processamento paralelo
- 🎨 **Sistema de temas** - 20+ temas inclusos + customizáveis
- 🐛 **Debugger** - Para Java, Python, Node.js
- ⚙️ **Diagnósticos** - Análise de código em tempo real
- 🌐 **SSH remoto** - Editar arquivos em máquinas remotas
- 🇧🇷 **Portugol** - Linguagem de programação em português
- ⌨️ **Runtimes gerenciados** - Java, Python, Node.js, Go, Rust, etc.
- 🧩 **Configurações completas** - Persistidas em JSON

---

## 💻 Requisitos

### Sistema Operacional
- ✅ Linux (Ubuntu, Fedora, Arch, etc.)
- ✅ Windows 10+
- ✅ macOS 10.14+

### Dependências Obrigatórias
- **Java 17+** (JDK)
  ```bash
  java -version  # Deve retornar versão 17 ou superior
  ```
- **Maven 3.8.0+**
  ```bash
  mvn -version  # Deve estar disponível no PATH
  ```

### Hardware Recomendado
- 4GB+ RAM
- 10GB+ espaço em disco
- Processador multi-core (para melhor performance)

---

## ⚡ Instalação Rápida

### Windows
```cmd
git clone https://github.com/CorelabsBR/CL_NPSharp.git
cd CL_NPSharp/NPSharpfx
scripts\dev-windows.bat
```

### Linux/macOS
```bash
git clone https://github.com/CorelabsBR/CL_NPSharp.git
cd CL_NPSharp/NPSharpfx
bash scripts/dev-linux.sh
```

**Pronto!** NPSharp deve abrir em ~30 segundos (primeira execução é mais lenta).

---

## 📖 Documentação

### 🎯 Comece Aqui

| Documento | Para Quem | Tempo |
|-----------|-----------|-------|
| **[docs/README.md](./docs/README.md)** | Índice de toda documentação | 5 min |
| **[docs/BUILD_AND_RUN.md](./docs/BUILD_AND_RUN.md)** | Developers, Build & CI/CD | 40 min |

### 🏗️ Para Desenvolvedores

| Documento | Assunto | Tempo |
|-----------|---------|-------|
| **[docs/ARCHITECTURE.md](./docs/ARCHITECTURE.md)** | Arquitetura interna, estrutura de pacotes, padrões | 30 min |
| **[docs/FEATURES.md](./docs/FEATURES.md)** | 16 funcionalidades principais, implementação | 60 min |
| **[docs/TECHNICAL_DECISIONS.md](./docs/TECHNICAL_DECISIONS.md)** | Decisões arquiteturais, trade-offs, trade-offs | 50 min |

### ⚙️ Para Usuários

| Documento | Assunto | Tempo |
|-----------|---------|-------|
| **[docs/CONFIGURATION.md](./docs/CONFIGURATION.md)** | Configurações, temas, wallpapers | 30 min |
| **[docs/UI.md](./docs/UI.md)** | Interface, componentes, estilos | 40 min |
| **[docs/COMMANDS.md](./docs/COMMANDS.md)** | Atalhos, menus, comandos | 20 min |

---

## 🏗️ Estrutura do Projeto

```
NPSharpfx/
├── docs/                          # Documentação técnica completa
├── src/main/java/br/com/corelabs/npsharpfx/
│   ├── Main.java                  # Ponto de entrada
│   ├── frontend/                  # UI (JavaFX)
│   │   ├── ui/                    # Componentes de interface
│   │   └── editor/                # Editor e diagnósticos
│   ├── backend/                   # Lógica de negócio
│   │   ├── git/                   # Integração Git
│   │   ├── debugger/              # Debugger
│   │   ├── runtime/               # Gerenciador de runtimes
│   │   └── engine/                # Search, syntax highlighting
│   └── config/                    # Configurações
├── src/main/resources/
│   ├── themes/                    # 20+ temas JSON
│   ├── css/                       # Estilos JavaFX
│   └── icons/                     # Ícones SVG
├── scripts/
│   ├── dev-linux.sh               # Desenvolvimento Linux
│   ├── dev-windows.bat            # Desenvolvimento Windows
│   ├── build-linux.sh             # Build release Linux
│   └── build-windows.bat          # Build release Windows
├── pom.xml                        # Configuração Maven
└── README.md                      # Este arquivo
```

---

## 📊 Compilar e Executar

### Desenvolvimento Rápido
```bash
# Linux/macOS
bash scripts/dev-linux.sh

# Windows
scripts\dev-windows.bat
```

### Build Release
```bash
# Linux/macOS
bash scripts/build-linux.sh

# Windows
scripts\build-windows.bat

# Resultado em dist/
```

### Executar Após Build
```bash
# Linux/macOS
dist/linux/run-npsharp.sh

# Windows
dist\windows\run-npsharp.exe
```

### Troubleshooting

**"java: command not found"**
```bash
# Ubuntu/Debian
sudo apt install openjdk-17-jdk

# macOS
brew install openjdk@17

# Verificar
java -version
```

**"mvn: command not found"**
```bash
# Ubuntu/Debian
sudo apt install maven

# macOS
brew install maven

# Verificar
mvn -version
```

**Mais problemas?** → [BUILD_AND_RUN.md - Troubleshooting](./docs/BUILD_AND_RUN.md#troubleshooting-de-build)

---

## 🛠️ Tecnologias Utilizadas

| Componente | Tecnologia | Versão |
|------------|------------|--------|
| **Framework UI** | JavaFX | 21.0.2 |
| **Linguagem** | Java | 17+ |
| **Build** | Maven | 3.8+ |
| **Editor de Código** | RichTextFX | 0.11.3 |
| **JSON Parser** | Gson | 2.11.0 |
| **SSH Client** | JSch | 0.1.55 |
| **SVG Rendering** | Batik | 1.17 |

---

## 📚 Funcionalidades Principais

### 1️⃣ **Editor de Código**
- Múltiplas abas para arquivos abertos
- Syntax highlighting para 15+ linguagens
- Números de linha, undo/redo
- Find/Replace com regex

### 2️⃣ **Terminal Integrado**
- Shell nativo (Bash, PowerShell, Zsh)
- Múltiplas abas de terminal
- Suporte a cores ANSI
- Histórico de comandos

### 3️⃣ **Integração Git**
- Descoberta automática de repositórios
- Status em tempo real (untracked, modified, staged)
- Diff visual de arquivos
- Histórico de commits
- Comandos: commit, push, pull, fetch, branch, merge

### 4️⃣ **Debugger**
- Breakpoints
- Step over/into/out
- Inspeção de variáveis
- Stack trace
- Suporta: Java, Python, Node.js

### 5️⃣ **Sistema de Temas**
- 20+ temas inclusos
- Customização de wallpaper + opacidade
- Temas personalizados por usuário
- Tema claro/escuro

**Veja todas as 16 funcionalidades:** [FEATURES.md](./docs/FEATURES.md)

---

## 🤝 Contribuindo

### 1. Reportar Bugs
Abra uma issue com:
- Sistema operacional
- Versão de Java
- Passos para reproduzir
- Comportamento esperado

### 2. Sugerir Funcionalidades
Abra uma issue descrevendo:
- Funcionalidade desejada
- Casos de uso
- Exemplos

### 3. Contribuir com Código

```bash
# 1. Fork e clone
git clone https://github.com/seu-usuario/CL_NPSharp.git
cd CL_NPSharp/NPSharpfx

# 2. Crie branch
git checkout -b minha-feature

# 3. Configure ambiente (veja BUILD_AND_RUN.md)
bash scripts/dev-linux.sh

# 4. Faça mudanças e teste
mvn test

# 5. Commit e push
git commit -am "Adiciona minha feature"
git push origin minha-feature

# 6. Abra Pull Request no GitHub
```

**Diretrizes:**
- Siga o código existente (indentação, nomes, estrutura)
- Adicione comentários para lógica complexa
- Teste suas mudanças
- Documente decisões técnicas se necessário

### 4. Melhorar Documentação
- Corrija typos
- Atualize informações
- Adicione exemplos
- Melhore clareza

---

## 📄 Licença

O projeto utiliza uma **licença proprietária Corelabs**, permitindo:

✅ Uso livre
✅ Modificação livre
✅ Redistribuição permitida

❌ Fechar o código derivado
❌ Usar a marca "NPSharp" sem permissão

**Leia o texto completo:** [LICENSE](./LICENSE)

---

## 🎯 Filosofia

NPSharp existe para:

- 🎓 **Reduzir dependência** de plataformas corporativas
- 🔓 **Permitir extensões** sem restrições
- ⚡ **Oferecer editor** rápido, direto e previsível
- 🔍 **Manter ecossistema** aberto e auditável
- 🎮 **Dar controle** total ao desenvolvedor
- 🚀 **Servir como base** para futuras variações

---

## 🗺️ Roadmap

- [ ] Plugin architecture
- [ ] Marketplace de extensões
- [ ] Suporte a mais linguagens (Kotlin, Elixir, etc.)
- [ ] Melhorias de performance
- [ ] Versão mobile (Android/iOS)
- [ ] Versão web

---

## ❓ FAQ

### P: Como instalar da forma mais rápida?
**R:** Veja [⚡ Instalação Rápida](#⚡-instalação-rápida) neste arquivo.

### P: Qual versão de Java é necessária?
**R:** Java 17+ (Long Term Support). Instale via:
- `apt install openjdk-17-jdk` (Ubuntu)
- `brew install openjdk@17` (macOS)
- https://adoptopenjdk.net/ (Windows)

### P: Como buildar um executável?
**R:** Veja [BUILD_AND_RUN.md - Build para Distribuição](./docs/BUILD_AND_RUN.md#build-para-distribuição)

### P: Posso usar comercialmente?
**R:** Sim, a licença permite uso comercial.

### P: Como contribuir?
**R:** Veja [🤝 Contribuindo](#🤝-contribuindo) neste arquivo.

---

## 🔗 Recursos

- **Website:** https://npsharp.corelabs.dev.br
- **GitHub:** https://github.com/CorelabsBR/CL_NPSharp
- **Issues:** https://github.com/CorelabsBR/CL_NPSharp/issues
- **Discussões:** https://github.com/CorelabsBR/CL_NPSharp/discussions

---

## 📊 Estatísticas

- **Linhas de código:** ~15,000+
- **Classes Java:** 117+
- **Temas inclusos:** 20+
- **Linguagens suportadas:** 15+
- **Dependências:** 8 principais
- **Documentação:** 9 arquivos, 50+ páginas

---

## 🙏 Agradecimentos

- [Microsoft VS Code](https://github.com/microsoft/vscode) - Design e inspiração
- [OpenJFX](https://openjfx.io/) - Framework UI JavaFX
- [RichTextFX](https://github.com/FXMisc/RichTextFX) - Componente de editor
- Comunidade de desenvolvedores brasileiros

---

**Última atualização:** 2026-07-02

**Repositório:** https://github.com/CorelabsBR/CL_NPSharp
