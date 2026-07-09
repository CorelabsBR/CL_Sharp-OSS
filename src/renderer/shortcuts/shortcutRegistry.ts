import { normalizeShortcut, type ShortcutBinding, type ShortcutCategory, type ShortcutScope } from "./keybindings";

export type ShortcutAction = () => void | Promise<void>;

export interface ShortcutRegistryOptions {
  actions: Record<string, ShortcutAction>;
  when?: Record<string, () => boolean>;
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
  shortcut("file.new", "File: New File", "Create a new untitled file.", ["Ctrl+N"], "File", "file.new", { allowInInput: true }),
  shortcut("file.open", "File: Open File", "Open a file using the platform picker.", ["Ctrl+O"], "File", "file.open", { allowInInput: true }),
  shortcut("file.openWorkspace", "File: Open Folder", "Open a desktop folder or mobile workspace.", ["Ctrl+K Ctrl+O"], "File", "file.openWorkspace"),
  shortcut("file.save", "File: Save", "Save the active editor.", ["Ctrl+S"], "File", "file.save", { allowInInput: true }),
  shortcut("file.saveAs", "File: Save As", "Save the active editor with a new path.", ["Ctrl+Shift+S"], "File", "file.saveAs", { allowInInput: true }),
  shortcut("file.closeEditor", "File: Close Editor", "Close the active editor tab.", ["Ctrl+W"], "File", "file.closeEditor"),
  shortcut("file.reopenClosedEditor", "File: Reopen Closed Editor", "Reopen the most recently closed editor tab.", ["Ctrl+Shift+T"], "File", "file.reopenClosedEditor"),
  shortcut("file.newWindow", "File: New Window", "Open a new NPSharp window when the desktop backend supports it.", ["Ctrl+Shift+N"], "File", "file.newWindow"),
  shortcut("file.recentWorkspaces", "File: Recent Workspaces", "Pick a recent workspace.", ["Ctrl+R"], "File", "file.recentWorkspaces"),

  shortcut("search.findInFile", "Search: Find in File", "Open Monaco Find in the current file.", ["Ctrl+F"], "Search", "search.findInFile", { scope: "editor", allowInInput: true }),
  shortcut("search.replaceInFile", "Search: Replace in File", "Open Monaco Replace in the current file.", ["Ctrl+H"], "Search", "search.replaceInFile", { scope: "editor", allowInInput: true }),
  shortcut("search.findInWorkspace", "Search: Find in Workspace", "Open the workspace Search panel.", ["Ctrl+Shift+F"], "Search", "search.findInWorkspace", { allowInInput: true }),
  shortcut("search.replaceInWorkspace", "Search: Replace in Workspace", "Open the workspace Search panel in replace mode.", ["Ctrl+Shift+H"], "Search", "search.replaceInWorkspace", { allowInInput: true }),
  shortcut("search.nextMatch", "Search: Next Match", "Move to the next file search result.", ["F3"], "Search", "search.nextMatch", { scope: "editor" }),
  shortcut("search.previousMatch", "Search: Previous Match", "Move to the previous file search result.", ["Shift+F3"], "Search", "search.previousMatch", { scope: "editor" }),
  shortcut("search.close", "Search: Close Search", "Close search UI when a search panel or transient UI is open.", ["Escape"], "Search", "view.closeTransient", { allowInInput: true, when: "canCloseTransient" }),

  shortcut("editor.toggleLineComment", "Editor: Toggle Line Comment", "Toggle line comments for the current selections.", ["Ctrl+/"], "Editor", "editor.toggleLineComment", { scope: "editor" }),
  shortcut("editor.addLineComment", "Editor: Add Line Comment", "Comment the selected lines.", ["Ctrl+K Ctrl+C"], "Editor", "editor.addLineComment", { scope: "editor" }),
  shortcut("editor.removeLineComment", "Editor: Remove Line Comment", "Uncomment the selected lines.", ["Ctrl+K Ctrl+U"], "Editor", "editor.removeLineComment", { scope: "editor" }),
  shortcut("editor.toggleBlockComment", "Editor: Toggle Block Comment", "Toggle a block comment around the selection.", ["Shift+Alt+A"], "Editor", "editor.toggleBlockComment", { scope: "editor" }),
  shortcut("editor.goToLine", "Editor: Go to Line", "Jump to a line in the current file.", ["Ctrl+G"], "Editor", "editor.goToLine", { scope: "editor", allowInInput: true }),
  shortcut("editor.selectNextOccurrence", "Editor: Select Next Occurrence", "Add the next matching selection.", ["Ctrl+D"], "Editor", "editor.selectNextOccurrence", { scope: "editor" }),
  shortcut("editor.selectAllOccurrences", "Editor: Select All Occurrences", "Select all matches of the current selection.", ["Ctrl+Shift+L"], "Editor", "editor.selectAllOccurrences", { scope: "editor" }),
  shortcut("editor.moveLineUp", "Editor: Move Line Up", "Move selected lines up.", ["Alt+Up"], "Editor", "editor.moveLineUp", { scope: "editor" }),
  shortcut("editor.moveLineDown", "Editor: Move Line Down", "Move selected lines down.", ["Alt+Down"], "Editor", "editor.moveLineDown", { scope: "editor" }),
  shortcut("editor.copyLineUp", "Editor: Copy Line Up", "Copy selected lines above.", ["Shift+Alt+Up"], "Editor", "editor.copyLineUp", { scope: "editor" }),
  shortcut("editor.copyLineDown", "Editor: Copy Line Down", "Copy selected lines below.", ["Shift+Alt+Down"], "Editor", "editor.copyLineDown", { scope: "editor" }),
  shortcut("editor.insertLineBelow", "Editor: Insert Line Below", "Insert a line below the current line.", ["Ctrl+Enter"], "Editor", "editor.insertLineBelow", { scope: "editor" }),
  shortcut("editor.insertLineAbove", "Editor: Insert Line Above", "Insert a line above the current line.", ["Ctrl+Shift+Enter"], "Editor", "editor.insertLineAbove", { scope: "editor" }),
  shortcut("editor.renameSymbol", "Editor: Rename Symbol", "Rename the symbol at the cursor when language support is available.", ["F2"], "Editor", "editor.renameSymbol", { scope: "editor" }),
  shortcut("editor.goToDefinition", "Editor: Go to Definition", "Go to definition when language support is available.", ["F12"], "Editor", "editor.goToDefinition", { scope: "editor" }),
  shortcut("editor.peekDefinition", "Editor: Peek Definition", "Peek definition when language support is available.", ["Alt+F12"], "Editor", "editor.peekDefinition", { scope: "editor" }),
  shortcut("editor.triggerSuggest", "Editor: Trigger Suggest", "Show completion suggestions.", ["Ctrl+Space"], "Editor", "editor.triggerSuggest", { scope: "editor" }),
  shortcut("editor.fileSymbols", "Editor: Go to Symbol in File", "Open the Monaco file symbol picker.", ["Ctrl+Shift+O"], "Editor", "editor.fileSymbols", { scope: "editor" }),

  shortcut("view.quickOpen", "View: Quick Open", "Open a file by name from open and recent files.", ["Ctrl+P"], "View", "view.quickOpen", { allowInInput: true }),
  shortcut("view.commandPalette", "View: Command Palette", "Open the command palette.", ["Ctrl+Shift+P"], "View", "view.commandPalette", { allowInInput: true }),
  shortcut("view.toggleTerminal", "View: Toggle Terminal", "Show or hide the integrated terminal panel.", ["Ctrl+`"], "View", "view.toggleTerminal"),
  shortcut("view.toggleSidebar", "View: Toggle Sidebar", "Show or hide the sidebar.", ["Ctrl+B"], "View", "view.toggleSidebar"),
  shortcut("view.toggleBottomPanel", "View: Toggle Bottom Panel", "Show or hide the bottom panel.", ["Ctrl+J"], "View", "view.toggleBottomPanel"),
  shortcut("view.nextTab", "View: Next Editor", "Activate the next editor tab.", ["Ctrl+Tab"], "View", "view.nextTab"),
  shortcut("view.previousTab", "View: Previous Editor", "Activate the previous editor tab.", ["Ctrl+Shift+Tab"], "View", "view.previousTab"),
  shortcut("view.navigateBack", "View: Navigate Back", "Navigate to the previous editor location.", ["Alt+Left"], "View", "view.navigateBack"),
  shortcut("view.navigateForward", "View: Navigate Forward", "Navigate to the next editor location.", ["Alt+Right"], "View", "view.navigateForward"),
  shortcut("view.keyboardShortcuts", "Preferences: Keyboard Shortcuts", "Open the Keyboard Shortcuts list.", ["Ctrl+K Ctrl+S"], "Preferences", "view.keyboardShortcuts"),
  shortcut("view.problems", "View: Problems", "Open the Problems panel.", ["Ctrl+Shift+M"], "View", "view.problems"),
  shortcut("view.output", "View: Output", "Open the Output log panel.", ["Ctrl+Shift+U"], "View", "view.output"),
  shortcut("view.settings", "Preferences: Settings", "Open Settings.", ["Ctrl+,"], "Preferences", "view.settings", { allowInInput: true }),
  shortcut("view.explorer", "View: Explorer", "Open Explorer.", ["Ctrl+Shift+E"], "View", "view.explorer"),
  shortcut("view.sourceControl", "View: Source Control", "Open Source Control.", ["Ctrl+Shift+G"], "Source Control", "view.sourceControl"),
  shortcut("view.extensions", "View: Extensions", "Open the Extensions placeholder.", ["Ctrl+Shift+X"], "View", "view.extensions"),

  shortcut("run.debug", "Run: Start Debugging", "Run or debug the current project or file.", ["F5"], "Run", "run.debug"),
  shortcut("run.withoutDebug", "Run: Run Without Debugging", "Run the current project or file without debug mode.", ["Ctrl+F5"], "Run", "run.withoutDebug"),
  shortcut("run.build", "Run: Build Task", "Run the configured build task.", ["Ctrl+Shift+B"], "Run", "run.build"),

  shortcut("npsharp.notes", "NPSharp: Open Notes", "Open or create the NPSharp notes file.", ["Ctrl+Alt+N"], "NPSharp", "npsharp.notes"),
  shortcut("npsharp.commandCenter", "NPSharp: Open Command Center", "Open the NPSharp Command Center.", ["Ctrl+Alt+C"], "NPSharp", "npsharp.commandCenter"),
  shortcut("npsharp.themeLab", "NPSharp: Open Theme Lab", "Open theme tools and special themes.", ["Ctrl+Alt+T"], "NPSharp", "npsharp.themeLab"),
  shortcut("npsharp.focusMode", "NPSharp: Toggle Focus Mode", "Toggle the clean Focus Mode layout.", ["Ctrl+Alt+P"], "NPSharp", "npsharp.focusMode"),
  shortcut("npsharp.projectHealth", "NPSharp: Project Health", "Open a project health summary.", ["Ctrl+Alt+H"], "NPSharp", "npsharp.projectHealth"),
  shortcut("npsharp.liveServer", "NPSharp: Toggle Live Server", "Start or stop Live Server for the current HTML file.", ["Ctrl+Alt+L"], "NPSharp", "npsharp.liveServer"),
  shortcut("npsharp.runDetected", "NPSharp: Run Current File", "Run the current file with runtime detection.", ["Ctrl+Alt+R"], "NPSharp", "npsharp.runDetected"),
  shortcut("npsharp.gitQuickActions", "NPSharp: Git Quick Actions", "Open stage, commit, push and pull actions.", ["Ctrl+Alt+G"], "NPSharp", "npsharp.gitQuickActions"),
  shortcut("npsharp.mobileLayout", "NPSharp: Toggle Compact Preview", "Toggle a compact/mobile preview layout when applicable.", ["Ctrl+Alt+M"], "NPSharp", "npsharp.mobileLayout"),
  shortcut("npsharp.clearTemporaryPanels", "NPSharp: Clear Temporary Panels", "Clear terminal, output or temporary panel content.", ["Ctrl+Alt+K"], "NPSharp", "npsharp.clearTemporaryPanels"),
  shortcut("npsharp.snapshot", "NPSharp: Snapshot Workspace", "Save a quick workspace/session snapshot when storage is available.", ["Ctrl+Alt+S"], "NPSharp", "npsharp.snapshot")
];

export function createShortcutRegistry(options: ShortcutRegistryOptions): ShortcutBinding[] {
  return DEFINITIONS.map(definition => ({
    id: definition.id,
    label: definition.label,
    description: definition.description,
    keys: definition.keys.map(normalizeShortcut),
    category: definition.category,
    scope: definition.scope,
    allowInInput: definition.allowInInput,
    when: definition.when ? options.when?.[definition.when] : undefined,
    run: options.actions[definition.action] ?? options.actions["fallback.unavailable"] ?? (() => undefined)
  }));
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
