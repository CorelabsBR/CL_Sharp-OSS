# Distribuições Windows

O Sharp-OSS gera três artefatos Windows distintos:

| Artefato | Uso | Atualização interna |
| --- | --- | --- |
| `Sharp-OSS-Setup-<versão>-x64.exe` | Instalação assistida por usuário | Sim, pelo `electron-updater`/NSIS |
| `Sharp-OSS-Portable-<versão>-x64.exe` | Executável único conveniente | Não; ele pode se extrair a cada abertura |
| `Sharp-OSS-Portable-Fast-<versão>-x64.zip` | Pasta portátil pré-extraída | Não; extraia uma vez e execute `Sharp-OSS.exe` |

O Portable Fast contém `portable.json`. Esse marcador faz o aplicativo manter
configurações, cache do Chromium e dados do Sharp-OSS em `data/`, ao lado do
executável. O Portable de executável único usa a mesma pasta `data/` ao lado
do arquivo iniciado. Nenhum dos dois grava dados em `~/.sharp`.

O Setup é por usuário, permite escolher o diretório, oferece atalhos de Área
de Trabalho e Menu Iniciar, inicia a aplicação ao final e preserva dados do
usuário na atualização e desinstalação. Não são registradas associações de
arquivo, menu de contexto ou inicialização automática sem uma escolha explícita
do usuário; o instalador padrão do electron-builder não oferece uma página
segura para esse consentimento sem script NSIS adicional.

Comandos:

```bash
npm run package:win
npm run package:portable-fast
```

Em CI Windows, o workflow gera Setup, Portable e Portable Fast, além de
`latest.yml`. Apenas o Setup é indicado nos metadados do atualizador.
