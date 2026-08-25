/*---------------------------------------------------------------------------------------------
- Copyright (c) CorelabsBR. All rights reserved.
- Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
import type { CustomShortcutBinding } from "../../shared/types";
import { isSafeCustomShortcut, normalizeShortcut, type ShortcutBinding, type ShortcutCategory, type ShortcutScope } from "./keybindings";

export type ShortcutAction = () => void | Promise<void>;

export interface ShortcutRegistryOptions {
  actions: Record<string, ShortcutAction>;
  when?: Record<string, () => boolean>;
  customBindings?: readonly CustomShortcutBinding[];
}

interface ShortcutDefinition {
  id: string;
  label: string;
  description: string;
  keys: string[];
  category: ShortcutCategory;
  action: string;
  scope?: ShortcutScope;
  allowInInput?: boolean;
  when?: string;
}

const DEFINITIONS: ShortcutDefinition[] = [
  shortcut("file.new", "Arquivo: Novo Arquivo", "Cria um novo arquivo sem título.", ["Ctrl+N"], "Arquivo", "file.new", { allowInInput: true }),
  shortcut("file.open", "Arquivo: Abrir Arquivo", "Abre um arquivo usando o seletor da plataforma.", ["Ctrl+O"], "Arquivo", "file.open", { allowInInput: true }),
  shortcut("file.openWorkspace", "Arquivo: Abrir Pasta", "Abre uma pasta no desktop ou um workspace mobile.", ["Ctrl+K Ctrl+O"], "Arquivo", "file.openWorkspace"),
  shortcut("file.save", "Arquivo: Salvar", "Salva o editor ativo.", ["Ctrl+S"], "Arquivo", "file.save", { allowInInput: true }),
  shortcut("file.saveAs", "Arquivo: Salvar Como", "Salva o editor ativo em um novo caminho.", ["Ctrl+Shift+S"], "Arquivo", "file.saveAs", { allowInInput: true }),
  shortcut("file.closeEditor", "Arquivo: Fechar Editor", "Fecha a aba do editor ativo.", ["Ctrl+W"], "Arquivo", "file.closeEditor"),
  shortcut("file.reopenClosedEditor", "Arquivo: Reabrir Editor Fechado", "Reabre a aba de editor fechada mais recentemente.", ["Ctrl+Shift+T"], "Arquivo", "file.reopenClosedEditor"),
  shortcut("file.newWindow", "Arquivo: Nova Janela", "Abre uma nova janela do Sharp-OSS quando o backend desktop tem suporte.", ["Ctrl+Shift+N"], "Arquivo", "file.newWindow"),
  shortcut("file.recentWorkspaces", "Arquivo: Workspaces Recentes", "Escolhe um workspace recente.", ["Ctrl+R"], "Arquivo", "file.recentWorkspaces"),

  shortcut("search.findInFile", "Busca: Localizar no Arquivo", "Abre o Localizar do Monaco no arquivo atual.", ["Ctrl+F"], "Busca", "search.findInFile", { scope: "editor", allowInInput: true }),
  shortcut("search.replaceInFile", "Busca: Substituir no Arquivo", "Abre o Substituir do Monaco no arquivo atual.", ["Ctrl+H"], "Busca", "search.replaceInFile", { scope: "editor", allowInInput: true }),
  shortcut("search.findInWorkspace", "Busca: Localizar no Workspace", "Abre o painel de Busca do workspace.", ["Ctrl+Shift+F"], "Busca", "search.findInWorkspace", { allowInInput: true }),
  shortcut("search.replaceInWorkspace", "Busca: Substituir no Workspace", "Abre o painel de Busca do workspace no modo substituir.", ["Ctrl+Shift+H"], "Busca", "search.replaceInWorkspace", { allowInInput: true }),
  shortcut("search.nextMatch", "Busca: Próxima Ocorrência", "Move para o próximo resultado de busca no arquivo.", ["F3"], "Busca", "search.nextMatch", { scope: "editor" }),
  shortcut("search.previousMatch", "Busca: Ocorrência Anterior", "Move para o resultado de busca anterior no arquivo.", ["Shift+F3"], "Busca", "search.previousMatch", { scope: "editor" }),
  shortcut("search.close", "Busca: Fechar Busca", "Fecha a UI de busca quando um painel de busca ou UI transitória está aberto.", ["Escape"], "Busca", "view.closeTransient", { allowInInput: true, when: "canCloseTransient" }),

  shortcut("editor.toggleLineComment", "Editor: Alternar Comentário de Linha", "Alterna comentários de linha para as seleções atuais.", ["Ctrl+/"], "Editor", "editor.toggleLineComment", { scope: "editor" }),
  shortcut("editor.addLineComment", "Editor: Adicionar Comentário de Linha", "Comenta as linhas selecionadas.", ["Ctrl+K Ctrl+C"], "Editor", "editor.addLineComment", { scope: "editor" }),
  shortcut("editor.removeLineComment", "Editor: Remover Comentário de Linha", "Descomenta as linhas selecionadas.", ["Ctrl+K Ctrl+U"], "Editor", "editor.removeLineComment", { scope: "editor" }),
  shortcut("editor.toggleBlockComment", "Editor: Alternar Comentário em Bloco", "Alterna um comentário em bloco ao redor da seleção.", ["Shift+Alt+A"], "Editor", "editor.toggleBlockComment", { scope: "editor" }),
  shortcut("editor.goToLine", "Editor: Ir para Linha", "Pula para uma linha no arquivo atual.", ["Ctrl+G"], "Editor", "editor.goToLine", { scope: "editor", allowInInput: true }),
  shortcut("editor.selectNextOccurrence", "Editor: Selecionar Próxima Ocorrência", "Adiciona a próxima seleção correspondente.", ["Ctrl+D"], "Editor", "editor.selectNextOccurrence", { scope: "editor" }),
  shortcut("editor.selectAllOccurrences", "Editor: Selecionar Todas as Ocorrências", "Seleciona todas as correspondências da seleção atual.", ["Ctrl+Shift+L"], "Editor", "editor.selectAllOccurrences", { scope: "editor" }),
  shortcut("editor.moveLineUp", "Editor: Mover Linha para Cima", "Move as linhas selecionadas para cima.", ["Alt+Up"], "Editor", "editor.moveLineUp", { scope: "editor" }),
  shortcut("editor.moveLineDown", "Editor: Mover Linha para Baixo", "Move as linhas selecionadas para baixo.", ["Alt+Down"], "Editor", "editor.moveLineDown", { scope: "editor" }),
  shortcut("editor.copyLineUp", "Editor: Copiar Linha para Cima", "Copia as linhas selecionadas acima.", ["Shift+Alt+Up"], "Editor", "editor.copyLineUp", { scope: "editor" }),
  shortcut("editor.copyLineDown", "Editor: Copiar Linha para Baixo", "Copia as linhas selecionadas abaixo.", ["Shift+Alt+Down"], "Editor", "editor.copyLineDown", { scope: "editor" }),
  shortcut("editor.insertLineBelow", "Editor: Inserir Linha Abaixo", "Insere uma linha abaixo da linha atual.", ["Ctrl+Enter"], "Editor", "editor.insertLineBelow", { scope: "editor" }),
  shortcut("editor.insertLineAbove", "Editor: Inserir Linha Acima", "Insere uma linha acima da linha atual.", ["Ctrl+Shift+Enter"], "Editor", "editor.insertLineAbove", { scope: "editor" }),
  shortcut("editor.renameSymbol", "Editor: Renomear Símbolo", "Renomeia o símbolo no cursor quando há suporte da linguagem.", ["F2"], "Editor", "editor.renameSymbol", { scope: "editor" }),
  shortcut("editor.goToDefinition", "Editor: Ir para Definição", "Vai para a definição quando há suporte da linguagem.", ["F12"], "Editor", "editor.goToDefinition", { scope: "editor" }),
  shortcut("editor.peekDefinition", "Editor: Espiar Definição", "Espia a definição quando há suporte da linguagem.", ["Alt+F12"], "Editor", "editor.peekDefinition", { scope: "editor" }),
  shortcut("editor.triggerSuggest", "Editor: Acionar Sugestões", "Mostra sugestões de completar código.", ["Ctrl+Space"], "Editor", "editor.triggerSuggest", { scope: "editor" }),
  shortcut("editor.fileSymbols", "Editor: Ir para Símbolo no Arquivo", "Abre o seletor de símbolos de arquivo do Monaco.", ["Ctrl+Shift+O"], "Editor", "editor.fileSymbols", { scope: "editor" }),
  shortcut("editor.toggleWordWrap", "Editor: Alternar Quebra de Linha", "Alterna a quebra de linhas longas.", ["Alt+Z"], "Editor", "editor.toggleWordWrap", { scope: "editor" }),

  shortcut("view.quickOpen", "Visualizar: Abertura Rápida", "Abre um arquivo pelo nome a partir dos arquivos abertos e recentes.", ["Ctrl+P"], "Visualizar", "view.quickOpen", { allowInInput: true }),
  shortcut("view.commandPalette", "Visualizar: Paleta de Comandos", "Abre a paleta de comandos.", ["Ctrl+Shift+P"], "Visualizar", "view.commandPalette", { allowInInput: true }),
  shortcut("view.toggleTerminal", "Visualizar: Alternar Terminal", "Mostra ou oculta o painel do terminal integrado.", ["Ctrl+`"], "Visualizar", "view.toggleTerminal"),
  shortcut("view.toggleSidebar", "Visualizar: Alternar Barra Lateral", "Mostra ou oculta a barra lateral.", ["Ctrl+B"], "Visualizar", "view.toggleSidebar"),
  shortcut("view.toggleBottomPanel", "Visualizar: Alternar Painel Inferior", "Mostra ou oculta o painel inferior.", ["Ctrl+J"], "Visualizar", "view.toggleBottomPanel"),
  shortcut("view.nextTab", "Visualizar: Próximo Editor", "Ativa a próxima aba de editor.", ["Ctrl+Tab"], "Visualizar", "view.nextTab"),
  shortcut("view.previousTab", "Visualizar: Editor Anterior", "Ativa a aba de editor anterior.", ["Ctrl+Shift+Tab"], "Visualizar", "view.previousTab"),
  shortcut("view.navigateBack", "Visualizar: Navegar para Trás", "Navega para o local anterior no editor.", ["Alt+Left"], "Visualizar", "view.navigateBack"),
  shortcut("view.navigateForward", "Visualizar: Navegar para Frente", "Navega para o próximo local no editor.", ["Alt+Right"], "Visualizar", "view.navigateForward"),
  shortcut("view.keyboardShortcuts", "Preferências: Atalhos de Teclado", "Abre a lista de Atalhos de Teclado.", ["Ctrl+K Ctrl+S"], "Preferências", "view.keyboardShortcuts"),
  shortcut("view.problems", "Visualizar: Problemas", "Abre o painel de Problemas.", ["Ctrl+Shift+M"], "Visualizar", "view.problems"),
  shortcut("view.output", "Visualizar: Saída", "Abre o painel de log de Saída.", ["Ctrl+Shift+U"], "Visualizar", "view.output"),
  shortcut("view.settings", "Preferências: Configurações", "Abre as Configurações.", ["Ctrl+,"], "Preferências", "view.settings", { allowInInput: true }),
  shortcut("view.explorer", "Visualizar: Explorador", "Abre o Explorador.", ["Ctrl+Shift+E"], "Visualizar", "view.explorer"),
  shortcut("view.sourceControl", "Visualizar: Controle de Origem", "Abre o Controle de Origem.", ["Ctrl+Shift+G"], "Controle de Origem", "view.sourceControl"),
  shortcut("view.extensions", "Visualizar: Extensões", "Abre o Gerenciador de Extensões.", ["Ctrl+Shift+X"], "Visualizar", "view.extensions"),

  shortcut("run.debug", "Executar: Iniciar Depuração", "Executa ou depura o projeto ou arquivo atual.", ["F5"], "Executar", "run.debug"),
  shortcut("run.withoutDebug", "Executar: Executar Sem Depuração", "Executa o projeto ou arquivo atual sem o modo de depuração.", ["Ctrl+F5"], "Executar", "run.withoutDebug"),
  shortcut("run.build", "Executar: Tarefa de Build", "Executa a tarefa de build configurada.", ["Ctrl+Shift+B"], "Executar", "run.build"),

  shortcut("sharp.notes", "Sharp-OSS: Abrir Notas", "Abre ou cria o arquivo de notas do Sharp-OSS.", ["Ctrl+Alt+N"], "Sharp-OSS", "sharp.notes"),
  shortcut("sharp.commandCenter", "Sharp-OSS: Abrir Central de Comandos", "Abre a Central de Comandos do Sharp-OSS.", ["Ctrl+Alt+C"], "Sharp-OSS", "sharp.commandCenter"),
  shortcut("sharp.themeLab", "Sharp-OSS: Abrir Laboratório de Temas", "Abre as ferramentas de temas e temas especiais.", ["Ctrl+Alt+T"], "Sharp-OSS", "sharp.themeLab"),
  shortcut("sharp.focusMode", "Sharp-OSS: Alternar Modo Foco", "Alterna o layout limpo do Modo Foco.", ["Ctrl+Alt+P"], "Sharp-OSS", "sharp.focusMode"),
  shortcut("sharp.projectHealth", "Sharp-OSS: Saúde do Projeto", "Abre um resumo de saúde do projeto.", ["Ctrl+Alt+H"], "Sharp-OSS", "sharp.projectHealth"),
  shortcut("sharp.liveServer", "Sharp-OSS: Alternar Live Server", "Inicia ou para o Live Server para o arquivo HTML atual.", ["Ctrl+Alt+L"], "Sharp-OSS", "sharp.liveServer"),
  shortcut("sharp.runDetected", "Sharp-OSS: Executar Arquivo Atual", "Executa o arquivo atual com detecção de runtime.", ["Ctrl+Alt+R"], "Sharp-OSS", "sharp.runDetected"),
  shortcut("sharp.gitQuickActions", "Sharp-OSS: Ações Rápidas do Git", "Abre ações de stage, commit, push e pull.", ["Ctrl+Alt+G"], "Sharp-OSS", "sharp.gitQuickActions"),
  shortcut("sharp.mobileLayout", "Sharp-OSS: Alternar Pré-visualização Compacta", "Alterna um layout de pré-visualização compacto/mobile quando aplicável.", ["Ctrl+Alt+M"], "Sharp-OSS", "sharp.mobileLayout"),
  shortcut("sharp.clearTemporaryPanels", "Sharp-OSS: Limpar Painéis Temporários", "Limpa o conteúdo do terminal, saída ou painéis temporários.", ["Ctrl+Alt+K"], "Sharp-OSS", "sharp.clearTemporaryPanels"),
  shortcut("sharp.snapshot", "Sharp-OSS: Capturar Workspace", "Salva uma captura rápida do workspace/sessão quando o armazenamento está disponível.", ["Ctrl+Alt+S"], "Sharp-OSS", "sharp.snapshot")
];

export function createShortcutRegistry(options: ShortcutRegistryOptions): ShortcutBinding[] {
  const defaults = DEFINITIONS.map(definition => bindingForDefinition(definition, options));
  const definitionsById = new Map(DEFINITIONS.map(definition => [definition.id, definition]));
  const seen = new Set<string>();
  const custom = (Array.isArray(options.customBindings) ? options.customBindings : [])
    .flatMap((saved, index) => {
      if (!saved || typeof saved.commandId !== "string" || typeof saved.key !== "string") return [];
      const definition = definitionsById.get(saved.commandId);
      const key = normalizeShortcut(saved.key);
      const identity = `${saved.commandId}\u0000${key}`;
      if (!definition || !isSafeCustomShortcut(key) || seen.has(identity)) return [];
      seen.add(identity);
      const binding = bindingForDefinition(definition, options);
      return [{
        ...binding,
        id: `custom.${definition.id}.${index}`,
        commandId: definition.id,
        custom: true,
        description: `${definition.description} (atalho personalizado)`,
        keys: [key]
      }];
    });
  return [...defaults, ...custom];
}

function bindingForDefinition(definition: ShortcutDefinition, options: ShortcutRegistryOptions): ShortcutBinding {
  return {
    id: definition.id,
    commandId: definition.id,
    label: definition.label,
    description: definition.description,
    keys: definition.keys.map(normalizeShortcut),
    category: definition.category,
    scope: definition.scope,
    allowInInput: definition.allowInInput,
    when: definition.when ? options.when?.[definition.when] : undefined,
    run: options.actions[definition.action] ?? options.actions["fallback.unavailable"] ?? (() => undefined)
  };
}

export function shortcutConflicts(shortcuts: readonly ShortcutBinding[]): Map<string, ShortcutBinding[]> {
  const byKey = new Map<string, ShortcutBinding[]>();
  for (const shortcut of shortcuts) {
    for (const key of shortcut.keys.map(normalizeShortcut)) {
      byKey.set(key, [...(byKey.get(key) ?? []), shortcut]);
    }
  }
  for (const [key, bindings] of byKey) {
    const uniqueIds = new Set(bindings.map(binding => binding.id));
    if (uniqueIds.size < 2) byKey.delete(key);
  }
  return byKey;
}

function shortcut(
  id: string,
  label: string,
  description: string,
  keys: string[],
  category: ShortcutCategory,
  action: string,
  options: Pick<ShortcutDefinition, "scope" | "allowInInput" | "when"> = {}
): ShortcutDefinition {
  return { id, label, description, keys, category, action, ...options };
}
