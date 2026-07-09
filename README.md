# NPSharp — Editor de Código Aberto e Independente

[![Feature Requests](https://img.shields.io/github/issues/girellidev/npsharp/feature-request.svg)](https://github.com/girellidev/npsharp/issues?q=is%3Aopen+is%3Aissue+label%3Aaprimoramento+sort%3Areactions-%2B1-desc)
[![Bugs](https://img.shields.io/github/issues/girellidev/npsharp/bug.svg)](https://github.com/girellidev/npsharp/issues?q=is%3Aopen+is%3Aissue+label%3Abug)
[![NPSharp Constructor](https://github.com/CorelabsBR/CL_NPSharp/actions/workflows/autochecker.yml/badge.svg)](https://github.com/CorelabsBR/CL_NPSharp/actions/workflows/autochecker.yml)

O **NPSharp** é um editor de código aberto desenvolvido pela Corelabs, construído sobre o projeto **NPSharp FX** e focado em oferecer uma experiência moderna, rápida e totalmente controlada pelo desenvolvedor.

O objetivo do projeto é disponibilizar um ambiente de desenvolvimento independente, transparente e auditável, eliminando dependências desnecessárias e permitindo que toda a evolução do editor aconteça de forma aberta.

🌐 Site oficial: https://npsharp.corelabs.dev.br

📄 Licença: https://npsharp.corelabs.dev.br/license/
A motivação do NPSHARP é simples e direta: criar um editor que seja **realmente independente**, **controlado pelo desenvolvedor**, **aberto ao público**, e que permita evolução contínua sem depender de decisões corporativas ou licenças restritivas.
O que está aqui é o ponto de partida. É o esqueleto, o motor cru, a base verificável.



## O que este repositório é
Este repositório contém:

- Código-fonte do NPSharp com ajustes necessários para permitir identidade própria.
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

## Command Center
Quando nenhum workspace está aberto, o NPSharp Electron exibe o Command Center como hub inicial do editor.

O hub permite abrir pasta, criar arquivo, criar projeto, clonar repositório Git, abrir terminal, abrir Notes, acessar temas/configurações, revisar atalhos e reabrir workspaces recentes. As ações usam as APIs reais do backend Electron/Node e os últimos workspaces ficam persistidos em `~/.npsharp/recent-files.json`.

## Desktop e Mobile

O renderer do NPSharp roda em Electron Desktop, Capacitor Mobile e fallback web/dev por meio de uma camada unica em `src/renderer/services/platform.ts` e `src/renderer/services/api.ts`.

No desktop, Git, terminal, runtimes locais, filesystem nativo e Live Server continuam usando o preload Electron/Node. No mobile, o app usa `@capacitor/filesystem`, cria um Mobile Workspace em `Documents/NPSharp/`, mantem Notes/settings/temas e mostra fallbacks claros para Git, terminal, runtimes locais e Live Server Node.

Veja os comandos e limitacoes em [`docs/MOBILE.md`](docs/MOBILE.md).

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
