# Codex no NPSharp

O NPSharp desktop integra o Codex pelo `codex app-server`, o mesmo protocolo criado para clientes ricos como a extensao do VS Code. A autenticacao pertence ao proprio Codex: o NPSharp abre o login oficial do ChatGPT no navegador e nunca recebe nem armazena os tokens da conta.

## Requisitos

O executavel `codex` pode vir do `PATH`, da extensao oficial `openai.chatgpt` instalada no NPSharp, VS Code, VS Code Insiders, VSCodium, Cursor ou Windsurf, ou do caminho definido em `NPSHARP_CODEX_PATH`.

## Uso

1. Abra o painel Codex e as Configuracoes de IA.
2. Selecione `Codex` e clique em `Entrar com ChatGPT`.
3. Conclua o login no navegador. O painel mostra o e-mail e o plano devolvidos pelo App Server.
4. Abra um workspace e inicie uma conversa. O seletor usa o catalogo real de modelos disponiveis para a conta.

O agente pode inspecionar, editar e testar somente o workspace local aberto. Sem um workspace local valido, a sessao opera em modo somente leitura. O acesso de rede das ferramentas permanece desabilitado. Use `Sair da conta` para encerrar a sessao persistida pelo Codex.

Referencias oficiais:

- https://learn.chatgpt.com/docs/auth
- https://learn.chatgpt.com/docs/codex/ide
- https://learn.chatgpt.com/docs/app-server
