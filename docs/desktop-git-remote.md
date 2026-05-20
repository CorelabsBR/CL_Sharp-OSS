# NPSharp Desktop: Git e Remote Host

## Arquitetura

O desktop agora separa as operacoes de projeto em servicos de backend e paineis JavaFX:

- `backend/git/GitService`: descobre repositorios Git no workspace, le status, branches, ahead/behind, historico, diff e executa operacoes em background.
- `frontend/ui/git/SourceControlPanel`: experiencia visual de Source Control com stage, unstage, commit, branch, fetch, pull, push, diff, descarte e resolucao de conflitos.
- `backend/filesystem/*`: contratos para providers locais/remotos (`LocalFileSystemProvider`, `RemoteFileSystemProvider`, `WorkspaceProvider`).
- `backend/remote/*`: cadastro de hosts, conexao SSH/SFTP, leitura/escrita remota e execucao de comandos remotos.
- `frontend/ui/remote/RemoteHostPanel`: UI para cadastrar/conectar hosts, navegar arquivos remotos, abrir/salvar arquivos e executar comandos.
- `EditorManager.openVirtualFile(...)`: permite abrir arquivos que nao existem como `File` local, usando callback de salvamento. Isso evita gambiarra no editor e permite providers remotos.

As operacoes demoradas rodam em `CompletableFuture`/executors e retornam para a UI com `Platform.runLater`, evitando bloquear a thread JavaFX.

## Bibliotecas usadas

- Git: usa o executavel `git` configurado no runtime do NPSharp ou encontrado no PATH. A escolha preserva compatibilidade com credenciais, remotes e hooks do usuario.
- Remote Host: usa `com.jcraft:jsch:0.1.55` para SSH/SFTP. A dependencia e pequena e cobre autenticacao por senha/chave, SFTP e execucao remota sem exigir servidor auxiliar.

## Como usar Git

1. Abra uma pasta no Explorer.
2. A Activity Bar mostra Source Control. O painel detecta automaticamente o repositorio da pasta e repositorios Git aninhados.
3. O status mostra arquivos modified, added, deleted, renamed, untracked, ignored e conflicted.
4. Use `Stage`/`Unstage` em cada arquivo, ou `Stage All`/`Unstage All`.
5. Escreva a mensagem e pressione `Commit`. Commit vazio e bloqueado por padrao; marque `Permitir commit vazio` para liberar.
6. Use `Fetch`, `Pull` e `Push` no painel.
7. Use `Branch` para trocar branch local ou criar uma nova. Checkout e bloqueado se houver alteracoes locais.
8. Use `Diff` para ver working tree vs HEAD ou staged vs HEAD.
9. Use `Discard` para descartar alteracoes com confirmacao.
10. Em conflitos, use `Resolve` para aceitar atual, recebido, ambos ou abrir diff manual.

Logs das operacoes Git sao enviados ao painel de terminal/output do NPSharp. O painel tambem faz refresh automatico periodico enquanto esta visivel para refletir mudancas feitas fora da IDE.

## Como usar Remote Host

1. Abra a Activity `Remote Host`.
2. Cadastre nome, host, porta, usuario, metodo de autenticacao e caminho remoto padrao.
3. Para senha, informe no campo de senha. Senhas nao sao salvas.
4. Para chave privada, selecione `key` e informe o caminho da chave. O caminho pode ser salvo; o segredo nao e embutido.
5. Clique em `Salvar Host` e depois `Conectar`.
6. Navegue a arvore/lista remota com duplo clique.
7. Duplo clique em arquivo abre uma aba remota editavel. `Ctrl+S` salva via SFTP.
8. Use os botoes para criar, renomear e excluir arquivos/pastas remotas.
9. Use o campo de comando remoto para executar comandos via SSH.
10. `Reconectar` tenta abrir a sessao novamente com os dados atuais.

## Limitacoes conhecidas

- O Git usa CLI em vez de JGit; isso melhora compatibilidade com credenciais existentes, mas depende de `git` instalado/configurado.
- O diff e exibido como texto unificado em dialog, ainda nao como editor lado a lado.
- O Remote Host salva configuracao em JSON local no app data. Senhas nao sao persistidas; integracao com keychain/secret store fica como proximo passo.
- O terminal remoto executa comandos avulsos. Uma sessao shell interativa persistente e um proximo passo.
- Providers remotos ja abrem/salvam no editor, mas o Explorer principal ainda representa apenas workspace local.

## Proximos passos

- Integrar um visual diff lado a lado usando duas instancias de editor.
- Trocar o refresh periodico do Git por watcher de filesystem granular por repositorio.
- Adicionar keychain para senhas/passphrases.
- Expor upload/download por seletor de arquivos local.
- Adicionar testes automatizados para parser de status Git e providers de filesystem.
