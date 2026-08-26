# Atualizações do Sharp-OSS

O Sharp-OSS usa GitHub Releases do repositório `CoreLabsBR/CL_Sharp-OSS` e o `electron-updater`. A verificação é feita depois de a IDE abrir e nunca usa Git, tokens ou acesso direto do renderer ao sistema.

## Formatos suportados

- Windows: instalador NSIS (`Sharp-OSS-Setup-<versão>-x64.exe`).
- Linux: AppImage (`Sharp-OSS-<versão>-x86_64.AppImage`).

Os formatos `Sharp-OSS-Portable-<versão>-x64.exe` e `Sharp-OSS-Portable-Fast-<versão>-x64.zip`, `.deb` do Linux e APK Android não são atualizados dentro do aplicativo. O Portable Fast usa dados locais em `data/` e deve ser atualizado extraindo a nova pasta sem substituir essa pasta. O updater nunca tenta instalar um Setup sobre uma edição portátil. O macOS não é publicado pelo workflow atual; antes de habilitá-lo é necessário configurar assinatura/notarização reais via secrets de CI, como `CSC_LINK`, `CSC_KEY_PASSWORD`, credenciais Apple e `APPLE_ID_PASSWORD`. Nenhum certificado ou segredo é incluído no repositório.

## Publicar uma versão

1. Atualize a versão em `package.json` e as referências sincronizadas do projeto.
2. Crie e envie a tag exatamente no formato `v<package.version>`.
3. O workflow valida a igualdade da tag, executa typecheck e testes, gera NSIS/AppImage e publica `latest.yml`, `latest-linux.yml`, instaladores e blockmaps na GitHub Release.

O `electron-updater` valida os hashes SHA-512 dos metadados de release antes de instalar os artefatos baixados.
