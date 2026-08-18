/*---------------------------------------------------------------------------------------------
- Copyright (c) CorelabsBR. All rights reserved.
- Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
import { api, platform } from "../services/api";
import { basename, relativePath } from "../utils/path";
import { el } from "../utils/dom";
import { CommandRegistry, fuzzyScore } from "../commands/commandRegistry";
import { parseQuickOpenQuery } from "../commands/quickOpen";

export interface CommandAction {
  id?: string;
  label: string;
  shortcut?: string;
  keywords?: string;
  run: () => void | Promise<void>;
}

export interface PaletteItem {
  label: string;
  hint?: string;
  keywords?: string;
  active?: boolean;
  swatch?: string;
  run: () => void | Promise<void>;
}

const QUICK_OPEN_IGNORED_DIRECTORIES = new Set([
  ".git", ".hg", ".svn", ".idea", ".gradle", ".settings", ".cache",
  "node_modules", "target", "build", "dist", "dist-electron", "out", "bin", "obj", "release", "vendor", "coverage"
]);
const MAX_QUICK_OPEN_FILES = 20_000;

export class CommandPalette {
  private commands: CommandAction[] = [];
  private quickOpenFiles: string[] = [];
  private workspaceFiles: string[] = [];
  private workspace?: string;
  private workspaceIndexGeneration = 0;
  private openFile: (file: string, line?: number, column?: number) => void = () => undefined;
  private registry?: CommandRegistry;

  setRegistry(registry: CommandRegistry): void {
    this.registry = registry;
  }

  setCommands(commands: CommandAction[]): void {
    this.commands = commands;
  }

  setWorkspace(workspace?: string): void {
    this.workspace = workspace;
    this.workspaceFiles = [];
    const generation = ++this.workspaceIndexGeneration;
    if (!workspace) return;
    void this.indexWorkspaceFiles(workspace, generation);
  }

  setQuickOpenFiles(files: string[]): void {
    this.quickOpenFiles = [...new Set(files)];
  }

  setFileOpener(opener: (file: string, line?: number, column?: number) => void): void {
    this.openFile = opener;
  }

  showCommands(): void {
    const registered = this.registry?.list(false).map(command => ({
      label: `${command.category}: ${command.title}`,
      hint: command.shortcut ?? "",
      keywords: [command.id, command.keywords ?? ""].join(" "),
      run: async () => { await this.registry?.execute(command.id); }
    })) ?? [];
    this.show(">", registered.length ? registered : this.commands.map(command => ({
      label: translateCommandLabel(command.label),
      hint: command.shortcut ?? "",
      keywords: [command.id ?? "", command.keywords ?? ""].join(" "),
      run: command.run
    })), "Digite um comando");
  }

  showQuickOpen(initialQuery = ""): void {
    this.show(initialQuery, this.quickOpenItems(), "Pesquisar arquivos por nome ou caminho", true);
  }
  //só pra botar o workflow funcionar

  showPicker(placeholder: string, items: PaletteItem[]): void {
    this.show("", items, placeholder);
  }

  close(): void {
    document.querySelector(".palette-overlay")?.remove();
  }

  private async indexWorkspaceFiles(workspace: string, generation: number): Promise<void> {
    if (platform.canUseNodeBackend && !workspace.startsWith("npsharp-remote://")) {
      try {
        const indexed = await api.search.files(workspace);
        if (generation === this.workspaceIndexGeneration) this.workspaceFiles = indexed;
      } catch (error) {
        console.warn(`[NPSharp quick open] Workspace index failed (${workspace})`, error);
      }
      return;
    }
    const files: string[] = [];
    const seen = new Set<string>();
    const walk = async (directory: string): Promise<void> => {
      if (generation !== this.workspaceIndexGeneration || files.length >= MAX_QUICK_OPEN_FILES) return;
      let entries;
      try {
        entries = await api.fs.listDir(directory);
      } catch {
        return;
      }
      for (const entry of entries) {
        if (generation !== this.workspaceIndexGeneration || files.length >= MAX_QUICK_OPEN_FILES) return;
        if (entry.directory) {
          if (!QUICK_OPEN_IGNORED_DIRECTORIES.has(entry.name.toLowerCase())) await walk(entry.path);
          continue;
        }
        if (!seen.has(entry.path)) {
          seen.add(entry.path);
          files.push(entry.path);
        }
      }
    };
    await walk(workspace);
    if (generation === this.workspaceIndexGeneration) {
      this.workspaceFiles = files.sort((left, right) => relativePath(workspace, left).localeCompare(relativePath(workspace, right), undefined, { sensitivity: "base" }));
    }
  }

  private quickOpenItems(line?: number, column?: number): PaletteItem[] {
    const files = [...new Set([...this.workspaceFiles, ...this.quickOpenFiles])];
    return files.map(file => ({
      label: this.workspace && file.startsWith(this.workspace) ? relativePath(this.workspace, file) : basename(file),
      hint: this.workspace && file.startsWith(this.workspace) ? "" : file,
      keywords: file,
      run: () => this.openFile(file, line, column)
    }));
  }

  private show(initialValue: string, items: PaletteItem[], placeholder: string, quickOpen = false): void {
    this.close();
    const overlay = el("div", { className: "palette-overlay" });
    const box = el("div", { className: "palette" });
    const input = el("input", { className: "palette-input", attrs: { value: initialValue, placeholder } });
    const list = el("div", { className: "palette-list", attrs: { role: "listbox" } });
    let selectedIndex = 0;
    let filteredItems: PaletteItem[] = [];
    box.append(input, list);
    overlay.append(box);
    document.body.append(overlay);

    const updateSelectedRow = (reveal = false) => {
      let selectedRow: HTMLElement | undefined;
      for (const row of list.querySelectorAll<HTMLElement>(".palette-row")) {
        const selected = Number(row.dataset.index) === selectedIndex;
        row.classList.toggle("active", selected);
        row.setAttribute("aria-selected", String(selected));
        if (selected) selectedRow = row;
      }
      if (reveal) selectedRow?.scrollIntoView({ block: "nearest", inline: "nearest" });
    };

    const render = () => {
      const parsed = quickOpen ? parseQuickOpenQuery(input.value) : { query: input.value.replace(/^>/, "").trim() };
      const query = parsed.query.toLowerCase();
      const candidates = quickOpen ? this.quickOpenItems(parsed.line, parsed.column) : items;
      filteredItems = candidates
        .map(item => ({ item, score: paletteScore(item, query) }))
        .filter(match => match.score >= 0)
        .sort((left, right) => right.score - left.score || left.item.label.localeCompare(right.item.label))
        .map(match => match.item)
        .slice(0, 50);
      selectedIndex = Math.min(selectedIndex, Math.max(filteredItems.length - 1, 0));
      list.replaceChildren();
      filteredItems.forEach((item, index) => {
        const row = el("button", {
          className: `palette-row ${index === selectedIndex ? "active" : ""} ${item.active ? "selected" : ""}`.trim(),
          attrs: { role: "option", "aria-selected": String(index === selectedIndex) }
        });
        row.dataset.index = String(index);
        const label = el("span", { className: "palette-label" });
        label.append(el("span", { className: "palette-check", text: item.active ? "✓" : "" }));
        if (item.swatch) {
          const swatch = el("span", { className: "palette-swatch" });
          swatch.style.background = item.swatch;
          label.append(swatch);
        }
        const text = el("span", { className: "palette-text" });
        appendHighlighted(text, item.label, query);
        label.append(text);
        row.append(label, el("span", { className: "menu-shortcut", text: item.hint ?? "" }));
        row.addEventListener("mouseenter", () => {
          selectedIndex = index;
          updateSelectedRow();
        });
        row.addEventListener("click", () => {
          overlay.remove();
          void item.run();
        });
        list.append(row);
      });
    };
    input.addEventListener("input", () => {
      selectedIndex = 0;
      render();
    });
    input.addEventListener("keydown", event => {
      if (event.key === "Escape") {
        event.preventDefault();
        overlay.remove();
        return;
      }
      if (event.key === "ArrowDown" || event.key === "ArrowUp") {
        event.preventDefault();
        if (filteredItems.length) {
          selectedIndex = (selectedIndex + (event.key === "ArrowDown" ? 1 : -1) + filteredItems.length) % filteredItems.length;
          updateSelectedRow(true);
        }
        return;
      }
      if (event.key === "Enter") {
        event.preventDefault();
        const item = filteredItems[selectedIndex];
        if (!item) return;
        overlay.remove();
        void item.run();
      }
    });
    overlay.addEventListener("click", event => {
      if (event.target === overlay) overlay.remove();
    });
    render();
    input.focus();
  }
}

function paletteScore(item: PaletteItem, query: string): number {
  if (!query) return 0;
  const label = item.label.toLowerCase();
  const score = fuzzyScore(query, [label, item.hint ?? "", item.keywords ?? ""].join(" ").toLowerCase());
  const basename = label.split(/[\\/]/).pop() ?? label;
  return score + (basename.includes(query) ? 500 : 0);
}

function appendHighlighted(container: HTMLElement, value: string, query: string): void {
  if (!query) {
    container.textContent = value;
    return;
  }
  let queryIndex = 0;
  for (const character of value) {
    const matched = queryIndex < query.length && character.toLowerCase() === query[queryIndex];
    container.append(el("span", { className: matched ? "palette-match" : "", text: character }));
    if (matched) queryIndex++;
  }
}

function translateCommandLabel(label: string): string {
  const translations: Record<string, string> = {
    "File: New File": "Arquivo: novo arquivo",
    "File: Open File": "Arquivo: abrir arquivo",
    "File: Open Folder": "Arquivo: abrir pasta",
    "File: Save": "Arquivo: salvar",
    "File: Save As": "Arquivo: salvar como",
    "File: Save All": "Arquivo: salvar tudo",
    "File: Close Editor": "Arquivo: fechar editor",
    "File: Close All Editors": "Arquivo: fechar todos os editores",
    "Editor: Go to Line": "Editor: ir para a linha",
    "Editor: Add Line Comment": "Editor: comentar linha",
    "Editor: Remove Line Comment": "Editor: descomentar linha",
    "Editor: Format Document": "Editor: formatar documento",
    "View: Explorer": "Exibir: explorador",
    "View: Search": "Exibir: pesquisar",
    "View: Source Control": "Exibir: controle de código-fonte",
    "View: Run and Debug": "Exibir: executar e depurar",
    "View: Extensions": "Exibir: extensões",
    "View: Arduino": "Exibir: Arduino",
    "View: Problems": "Exibir: problemas",
    "View: Command Palette": "Exibir: paleta de comandos",
    "View: Quick Open": "Exibir: abertura rápida",
    "View: Toggle Sidebar": "Exibir: alternar barra lateral",
    "Terminal: Toggle Terminal": "Terminal: alternar terminal",
    "Terminal: New Terminal": "Terminal: novo terminal",
    "Terminal: Output": "Terminal: saída",
    "Terminal: Debug Console": "Terminal: console de depuração",
    "Terminal: Clear": "Terminal: limpar",
    "Run: Run Current File": "Executar: arquivo atual",
    "Run: Build Project": "Executar: compilar projeto",
    "Preferences: Settings": "Preferências: configurações",
    "Preferences: Color Theme": "Preferências: tema de cores",
    "Preferences: Wallpaper": "Preferências: papel de parede",
    "Preferences: Clear Wallpaper": "Preferências: limpar papel de parede",
    "Preferences: ErrorLens Toggle": "Preferências: alternar ErrorLens",
    "Search: Find": "Pesquisar: localizar",
    "Search: Replace": "Pesquisar: substituir",
    "Search: Find in Workspace": "Pesquisar: localizar no workspace",
    "Extensions: Install from VSIX": "Extensões: instalar de VSIX",
    "Extensions: Reload": "Extensões: recarregar",
    "Extensions: Enable": "Extensões: habilitar",
    "Extensions: Disable": "Extensões: desabilitar",
    "Extensions: Show Installed": "Extensões: mostrar instaladas",
    "Notes: Show Notes": "Notas: mostrar notas",
    "AI: Open Chat": "IA: abrir conversa",
    "AI: New Conversation": "IA: nova conversa",
    "AI: Clear Conversation": "IA: limpar conversa",
    "AI: Change Provider": "IA: alterar provedor",
    "AI: Change Model": "IA: alterar modelo",
    "AI: Explain Selection": "IA: explicar seleção",
    "AI: Refactor Selection": "IA: refatorar seleção",
    "AI: Optimize Selection": "IA: otimizar seleção",
    "AI: Generate Documentation": "IA: gerar documentação",
    "AI: Generate Unit Tests": "IA: gerar testes unitários",
    "AI: Fix Errors": "IA: corrigir erros",
    "AI: Commit Message": "IA: mensagem de commit",
    "AI: Rename Symbols with AI": "IA: renomear símbolos"
  };
  return translations[label] ?? label;
}
