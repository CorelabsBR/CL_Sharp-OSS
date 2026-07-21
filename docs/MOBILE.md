# NPSharp Desktop e Mobile

O NPSharp usa a mesma base renderer para Electron, Capacitor e fallback web. A camada `src/renderer/services/platform.ts` detecta o ambiente e `src/renderer/services/api.ts` escolhe a implementacao correta para filesystem, settings, Git, terminal, runtimes e Live Server.

## Plataformas

- Electron Desktop: usa `window.npsharpApi` ou `window.npsharp` vindo do preload. Tem filesystem nativo, Git real, terminal real, runtimes locais, diagnosticos Java e Live Server Node.
- Capacitor Mobile: usa `Capacitor.isNativePlatform()` e `@capacitor/filesystem`. Tem workspace mobile no sandbox do app, Notes, settings, temas e preview HTML. Git, terminal real, runtimes locais e Live Server Node ficam em modo limitado.
- Web/dev fallback: usa memoria/localStorage para settings, sessao e arquivos basicos. Serve para desenvolvimento do renderer sem Electron nem app nativo.

## Mobile Workspace

No mobile nao existe um workspace arbitrario do sistema como no desktop. O NPSharp separa dados internos da area de arquivos do usuario:

```text
Directory.Data/NPSharp/settings.json
Directory.Data/NPSharp/session.json
Documents/NPSharp/notes.nps.md
Documents/NPSharp/workspaces/
```

Settings, sessao e configuracoes internas usam `Directory.Data` e nao dependem da permissao publica de armazenamento. Notes, Explorer, busca e workspaces usam `Documents/NPSharp`; antes da primeira operacao o app chama `Filesystem.checkPermissions()`/`Filesystem.requestPermissions()`. Se a permissao for negada, a operacao e interrompida com uma mensagem clara ao usuario.

O Command Center mostra "Abrir workspace mobile" e cria/abre pastas dentro de `Documents/NPSharp/workspaces` apos a autorizacao do sistema.

## Recursos

- Desktop: Command Center, Notes, Source Control/Git, terminal, Live Server, Run, Theme Lab, settings, diagnosticos e filesystem completo seguem pelo backend Electron/Node.
- Mobile: Command Center, Notes, Theme Lab, settings, editor, Explorer, busca local no sandbox e preview HTML funcionam sem backend Node.
- Mobile limitado: Source Control mostra modo limitado; Git nativo completo depende de backend futuro. Terminal vira Output/Command Log. Run nao tenta executar Node/Python/Java locais. Live Server nao inicia servidor Node e usa preview HTML quando possivel.

## Scripts

```bash
npm run typecheck
npm run build:renderer
npm run build:electron
npm run build:mobile
npm run cap:sync
npm run android:open
```

`npm run build` continua sendo o build/package desktop existente. Para mobile, prefira `npm run build:mobile` ou `npm run cap:sync`, que geram o renderer e sincronizam o Android sem empacotar Electron.

## Android

O Android usa:

```text
appId/applicationId: br.com.corelabs.npsharp
appName: NPSharp
webDir: dist
```

O manifesto declara `READ_EXTERNAL_STORAGE` ate Android 12L, `WRITE_EXTERNAL_STORAGE` ate Android 10 e `requestLegacyExternalStorage` para compatibilidade com Android 10. Em Android 11 ou superior, `Directory.Documents` continua limitado pelo proprio sistema aos arquivos/pastas que o app criou.

Depois de alterar assets ou dependencias Capacitor:

```bash
npm run cap:sync
```

Abra o projeto nativo com:

```bash
npm run android:open
```

Builds Gradle/APK/AAB nao devem ser versionados.

## Limitacoes atuais

- Git nativo no mobile ainda nao esta implementado.
- Terminal real no mobile ainda nao existe.
- Runtimes locais para Java, Python, Node e outras linguagens dependem de backend nativo futuro.
- Live Server Node e PHP continuam desktop-only; HTML usa preview local no mobile.
