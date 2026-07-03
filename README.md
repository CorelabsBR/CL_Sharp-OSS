# NPSharp – Editor de Código Aberto e Independente\n\n[![Feature Requests](https://img.shields.io/github/issues/girellidev/npsharp/feature-request.svg)](https://github.com/girellidev/npsharp/issues?q=is%3Aopen+is%3Aissue+label%3Aaprimoramento+sort%3Areactions-%2B1-desc)\n[![Bugs](https://img.shields.io/github/issues/girellidev/npsharp/bug.svg)](https://github.com/girellidev/npsharp/issues?utf8=✓&q=is%3Aissue+is%3Aopen+label%3Abug)\n[![NPSharp Constructor](https://github.com/CorelabsBR/CL_NPSharp/actions/workflows/autochecker.yml/badge.svg)](https://github.com/CorelabsBR/CL_NPSharp/actions/workflows/autochecker.yml)\n\n[NPSharp](https://npsharp.corelabs.dev.br) é distribuído sob uma [Licença Proprietária Corelabs](https://npsharp.corelabs.dev.br/license/)\n\n## O que é NPSharp?\n\n**NPSharp** reúne tudo o que o Visual Studio Code oferece — só que sem telemetria, sem coleta escondida, sem travas, e com otimizações feitas por alguém que realmente escreve código todos os dias.\n\nÉ a experiência completa do editor, mas construída para desenvolvedores de verdade, por um desenvolvedor que não aceita ficar abaixo de ninguém.\nAqui a ferramenta trabalha no seu nível — acima do resto.\n\n**NPSharp é atualizado mensalmente** com novas funcionalidades e correções. Você pode baixá-lo em Windows, macOS e Linux no [site oficial](https://npsharp.corelabs.dev.br#download).\n\n## Principais Recursos\n\n- ✨ **Editor moderno** com syntax highlighting para 15+ linguagens\n- 🔌 **Terminal integrado** (Bash, PowerShell, Zsh)\n- 🌳 **Explorador de arquivos** com ícones por tipo\n- 🐙 **Git integrado** - status, commit, push, pull, diff\n- 🔍 **Busca poderosa** - regex, workspace, paralela\n- 🎨 **Sistema de temas** - 20+ temas inclusos + customizáveis\n- 🐛 **Debugger** para Java, Python, Node.js\n- ⚙️ **Diagnósticos** - análise de código em tempo real\n- 🌐 **SSH remoto** - editar arquivos em máquinas remotas\n- 🇧🇷 **Portugol** - linguagem de programação em português\n- ⌨️ **Runtimes gerenciados** - Java, Python, Node.js, Go, Rust, etc.\n- 🧩 **Configurações completas** - persistidas em JSON\n\n## Requisitos\n\n### Sistema Operacional\n- ✅ Linux (Ubuntu, Fedora, Arch, etc.)\n- ✅ Windows 10+\n- ✅ macOS 10.14+\n\n### Dependências\n- **Java 17+** (JDK)\n  ```bash\n  java -version  # Deve retornar 17 ou superior\n  ```\n- **Maven 3.8.0+**\n  ```bash\n  mvn -version  # Deve estar disponível\n  ```\n- **Git** (opcional, mas recomendado)\n\n### Hardware Recomendado\n- 4GB+ RAM\n- 10GB+ espaço em disco\n- Processador multi-core (para melhor performance)\n\n## Instalação e Uso Rápido\n\n### Windows\n```cmd\n# 1. Clonar repositório\ngit clone https://github.com/CorelabsBR/CL_NPSharp.git\ncd CL_NPSharp/NPSharpfx\n\n# 2. Executar em modo desenvolvimento\nscripts\\dev-windows.bat\n```\n\n### Linux/macOS\n```bash\n# 1. Clonar repositório\ngit clone https://github.com/CorelabsBR/CL_NPSharp.git\ncd CL_NPSharp/NPSharpfx\n\n# 2. Executar em modo desenvolvimento\nbash scripts/dev-linux.sh\n```\n\n## Documentação Técnica\n\n### 📖 Começar Aqui\n- **[docs/README.md](./docs/README.md)** - Índice completo de documentação\n- **[BUILD_AND_RUN.md](./docs/BUILD_AND_RUN.md)** - Guia completo de build e execução\n\n### 🏗️ Para Desenvolvedores\n- **[ARCHITECTURE.md](./docs/ARCHITECTURE.md)** - Arquitetura interna, estrutura de pacotes\n- **[FEATURES.md](./docs/FEATURES.md)** - Todas as funcionalidades (16 principais)\n- **[TECHNICAL_DECISIONS.md](./docs/TECHNICAL_DECISIONS.md)** - Decisões arquiteturais e trade-offs\n\n### ⚙️ Para Usuários\n- **[CONFIGURATION.md](./docs/CONFIGURATION.md)** - Configurações, temas, wallpapers\n- **[UI.md](./docs/UI.md)** - Interface de usuário, componentes, estilos\n- **[COMMANDS.md](./docs/COMMANDS.md)** - Atalhos de teclado, menus, comandos\n\n## Compilar e Executar\n\n### Desenvolvimento Rápido\n```bash\n# Linux/macOS\nbash scripts/dev-linux.sh\n\n# Windows\nscripts\\dev-windows.bat\n```\n\n### Build Completo\n```bash\n# Linux/macOS\nbash scripts/build-linux.sh\n\n# Windows\nscripts\\build-windows.bat\n```\n\n### Executar JAR Diretamente\n```bash\n# Após build\ndist/linux/run-npsharp.sh              # Linux/macOS\ndist\\windows\\run-npsharp.exe           # Windows\n```\n\n### Troubleshooting\nSe encontrar problemas com:\n- **\"java: command not found\"** → [Instalar Java 17+](./docs/BUILD_AND_RUN.md#problema-java-command-not-found)\n- **\"mvn: command not found\"** → [Instalar Maven](./docs/BUILD_AND_RUN.md#problema-mvn-command-not-found)\n- **Erros de compilação** → Ver [guia de troubleshooting](./docs/BUILD_AND_RUN.md#troubleshooting-de-build)\n\n## Estrutura do Projeto

A motivação do NPSHARP é simples e direta: criar um editor que seja **realmente independente**, **controlado pelo desenvolvedor**, **aberto ao público**, e que permita evolução contínua sem depender de decisões corporativas ou licenças restritivas.
O que está aqui é o ponto de partida. É o esqueleto, o motor cru, a base verificável.

E sim, este projeto também carrega a presença dela. Não no código, não como recurso técnico,
mas como parte da força que mantém o projeto andando. A pessoa que virou combustível silencioso
pra tudo isso existir. A versão distribuída é cheia disso — aqui aparece só o reflexo, mas ainda está aqui.


## O que este repositório é
Este repositório contém:

- Código-fonte do Code-OSS com ajustes necessários para permitir identidade própria.
- Configurações, patches e modificações essenciais para manter compatibilidade e independência.
- Ambiente pronto para contribuições, testes e builds limpos.
- A fundação do editor **NPSHARP Clean**, usado como base de desenvolvimento.

Este repositório **não** é a versão distribuída no site npsharp.girelli.dev.br.

## O que NÃO é este repositório
A versão oferecida no [site](https://npsharp.corelabs.dev.br)

É outro software. Compartilha origem, mas segue caminho próprio.

Este repositório aqui é **transparente e técnico**.
O da distribuição é **polido e funcional**.

## Filosofia do Projeto
O NPSHARP existe para:

- Reduzir dependência de lojas externamente controladas
- Permitir extensões personalizadas sem restrições
- Fornecer editor rápido, direto e previsível
- Manter o ecossistema aberto, auditável e livre
- Atender devs que querem controle total da ferramenta
- Criar uma base para futuras variações do editor

## Licença
O projeto utiliza uma **licença personalizada**, permitindo:

- Uso livre
- Modificação livre
- Redistribuição permitida
- Proibição explícita de fechar o código derivado
- Proibição de uso da marca “NPSHARP” sem permissão
- Obrigatoriedade de manter créditos originais

O texto completo da licença está no arquivo LICENSE e deve ser respeitado integralmente.

## Contribuindo

Existem várias formas de participar do desenvolvimento do NPSHARP:

* Reportar bugs e sugerir novas funcionalidades na aba de Issues do repositório.
* Revisar mudanças no código enviadas por outros contribuidores.
* Ajudar a melhorar a documentação com correções, melhorias ou novos conteúdos.

Se você deseja contribuir diretamente para o código-fonte,
consulte o guia completo de contribuição deste projeto:

* [Como compilar e executar a partir do código-fonte](https://npsharp.corelabs.dev.br)
* [Fluxo de desenvolvimento: depuração, testes e organização interna](https://npsharp.corelabs.dev.br)
* [Diretrizes de codificação usadas neste projeto](https://npsharp.corelabs.dev.br)
* [Como enviar Pull Requests para revisão](https://npsharp.corelabs.dev.br)
* [Onde encontrar tarefas e pontos do projeto que precisam de ajuda](https://npsharp.corelabs.dev.br)
* [Como contribuir com traduções da interface](https://npsharp.corelabs.dev.br)

O NPSHARP é um projeto independente.
Toda contribuição é bem-vinda, desde que siga as diretrizes e respeite a filosofia do editor:
**código limpo, controle total e liberdade ao desenvolvedor.**


## Build
O projeto suporta:

- Build local
- Build em containers
- Modificações diretas sem patch reverso
- Ambientes controlados e previsíveis

Instruções detalhadas estão em `BUILDING.md`.
Pronto para colocar no GitHub.

