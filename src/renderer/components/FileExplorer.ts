import type { WorkspaceChangeEvent, WorkspaceEntry } from "../../shared/types";
import { api, platform } from "../services/api";
import { buttonIcon, contextMenu, el, fileIcon } from "../utils/dom";
import { reportError } from "../utils/errors";
import { basename, dirname, isSubPath, joinPath, normalizePath, pathSeparator, relativePath, samePath } from "../utils/path";

interface TreeNode {
  entry: WorkspaceEntry;
  childrenLoaded: boolean;
  expanded: boolean;
}

export class FileExplorer {
  readonly element = el("div", { className: "panel explorer-panel" });
  private readonly toolbar = el("div", { className: "panel-toolbar" });
  private readonly tree = el("div", { className: "file-tree" });
  private readonly empty = el("div", { className: "empty-state" });
  private root?: string;
  private selectedPath?: string;
  private nodes = new Map<string, TreeNode>();
  private unwatchWorkspace?: () => void;
  private refreshTimer?: number;
  private refreshInFlight = false;
  private refreshQueued = false;
  private disposed = false;

  onWorkspaceChanged: (workspace?: string) => void = () => undefined;

  constructor(
    private readonly onFileOpen: (filePath: string) => void,
    private readonly updateStatus: (text: string) => void
  ) {
    this.build();
  }


  get workspace(): string | undefined {
    return this.root;
  }

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    this.stopWatching();
    this.nodes.clear();
  }

  async openFolderFromDialog(): Promise<void> {
    if (this.disposed) return;
    const result = await api.dialog.openFolder();
    if (this.disposed) return;
    if (!result.canceled && result.paths[0]) {
      await this.openFolder(result.paths[0]);
    }
  }

  async openFolder(folder: string): Promise<void> {
    if (this.disposed) return;
    const normalizedFolder = normalizePath(folder);
    const previousRoot = this.root;
    const previousNodes = new Map(this.nodes);
    this.stopWatching();
    this.root = normalizedFolder;
    this.selectedPath = normalizedFolder;
    this.nodes = new Map();
    const rootEntry: WorkspaceEntry = { path: normalizedFolder, name: basename(normalizedFolder), directory: true, size: 0, modifiedAt: 0, hidden: false };
    this.nodes.set(normalizedFolder, { entry: rootEntry, childrenLoaded: false, expanded: true });
    try {
      await this.loadChildren(normalizedFolder, true);
      if (this.disposed) return;
      this.watchFolder(normalizedFolder);
      this.onWorkspaceChanged(normalizedFolder);
      this.render();
      this.updateStatus(`Workspace aberto: ${normalizedFolder}`);
    } catch (error) {
      if (this.disposed) return;
      this.root = previousRoot;
      this.nodes = previousNodes;
      this.watchFolder(previousRoot);
      this.render();
      reportError(error, this.updateStatus, `Nao foi possivel abrir workspace (${normalizedFolder})`);
    }
  }

  clearFolder(): void {
    if (this.disposed) return;
    this.stopWatching();
    this.root = undefined;
    this.selectedPath = undefined;
    this.nodes = new Map();
    this.onWorkspaceChanged(undefined);
    this.render();
  }

  async refresh(options: { silent?: boolean } = {}): Promise<void> {
    if (this.disposed) return;
    if (this.refreshInFlight) {
      this.refreshQueued = true;
      return;
    }
    this.refreshInFlight = true;
    try {
      if (!this.root) {
        this.render();
        return;
      }
      const expanded = new Set([...this.nodes.values()].filter(node => node.expanded).map(node => node.entry.path));
      const root = this.root;
      this.nodes = new Map();
      this.nodes.set(root, { entry: { path: root, name: basename(root), directory: true, size: 0, modifiedAt: 0, hidden: false }, childrenLoaded: false, expanded: true });
      await this.loadChildren(root, true);
      if (this.disposed) return;
      for (const item of expanded) {
        const node = this.nodes.get(item);
        if (node?.entry.directory) {
          node.expanded = true;
          await this.loadChildren(item, true);
          if (this.disposed) return;
        }
      }
      this.render();
      if (!options.silent) this.updateStatus("Explorer atualizado");
    } catch (error) {
      reportError(error, this.updateStatus, "Nao foi possivel atualizar o Explorer");
    } finally {
      this.refreshInFlight = false;
      if (this.refreshQueued) {
        this.refreshQueued = false;
        void this.refresh({ silent: true });
      }
    }
  }

  collapseAll(): void {
    if (this.disposed) return;
    for (const node of this.nodes.values()) {
      node.expanded = node.entry.path === this.root;
    }
    this.render();
  }

  async revealFile(filePath: string): Promise<void> {
    if (this.disposed) return;
    if (!this.root || !isSubPath(this.root, filePath)) return;
    const segments = relativePath(this.root, dirname(filePath)).split(pathSeparator()).filter(Boolean);
    let current = this.root;
    for (const segment of segments) {
      current = joinPath(current, segment);
      const node = this.nodes.get(current);
      if (node) {
        node.expanded = true;
        await this.loadChildren(current, true);
        if (this.disposed) return;
      }
    }
    this.render();
  }

  private build(): void {
    this.toolbar.append(
      buttonIcon("new-file", "Novo arquivo", () => void this.createInSelected(false)),
      buttonIcon("new-folder", "Nova pasta", () => void this.createInSelected(true)),
      buttonIcon("refresh", "Atualizar", () => void this.refresh()),
      buttonIcon("collapse-all", "Recolher tudo", () => this.collapseAll())
    );

    const title = el("div", { className: "empty-title", text: platform.isMobile ? "Nenhum workspace mobile aberto" : "Nenhuma pasta aberta" });
    const subtitle = el("div", {
      className: "empty-subtitle",
      text: platform.isMobile ? "Abra um workspace mobile no sandbox do app." : "Abra uma pasta para exibir os arquivos no Explorer."
    });
    const open = el("button", { className: "primary", text: platform.isMobile ? "Open Mobile Workspace" : "Open Folder" });
    open.addEventListener("click", () => void this.openFolderFromDialog());
    this.empty.append(title, subtitle, open);
    this.element.append(this.toolbar, this.tree, this.empty);
    this.render();
  }

  private async loadChildren(dir: string, force = false): Promise<void> {
    const node = this.nodes.get(dir);
    if (!node || !node.entry.directory) return;
    if (node.childrenLoaded && !force) return;
    const entries = await api.fs.listDir(dir);
    const paths = new Set(entries.map(entry => entry.path));
    for (const childPath of [...this.nodes.keys()]) {
      if (samePath(dirname(childPath), dir) && !samePath(childPath, dir) && !paths.has(childPath)) {
        this.removeSubtree(childPath);
      }
    }
    for (const entry of entries) {
      const existing = this.nodes.get(entry.path);
      this.nodes.set(entry.path, {
        entry,
        childrenLoaded: existing?.childrenLoaded ?? false,
        expanded: existing?.expanded ?? false
      });
    }
    node.childrenLoaded = true;
  }

  private removeSubtree(targetPath: string): void {
    for (const nodePath of [...this.nodes.keys()]) {
      if (nodePath === targetPath || isSubPath(targetPath, nodePath)) {
        this.nodes.delete(nodePath);
      }
    }
  }

  private render(): void {
    if (this.disposed) return;
    const hasRoot = Boolean(this.root);
    this.toolbar.hidden = !hasRoot;
    this.tree.hidden = !hasRoot;
    this.empty.hidden = hasRoot;
    this.tree.replaceChildren();
    if (this.root) {
      this.tree.append(this.renderNode(this.root, 0));
    }
  }

  private renderNode(nodePath: string, depth: number): HTMLElement {
    const node = this.nodes.get(nodePath)!;
    const row = el("div", { className: `tree-row${samePath(this.selectedPath ?? "", nodePath) ? " selected" : ""}`, attrs: { "data-path": nodePath } });
    row.style.paddingLeft = `${depth * 14 + 6}px`;
    const twisty = el("span", { className: "tree-twisty", text: node.entry.directory ? (node.expanded ? "▾" : "▸") : "" });
    row.append(twisty, fileIcon(node.entry.name, node.entry.directory, node.expanded), el("span", { className: "tree-label", text: node.entry.name }));

    row.addEventListener("click", () => {
      this.selectedPath = node.entry.path;
      void this.openNode(node);
    });
    row.addEventListener("contextmenu", event => {
      event.preventDefault();
      this.showMenu(node, event.clientX, event.clientY);
    });

    const wrapper = el("div", { className: "tree-node" });
    wrapper.append(row);
    if (node.expanded && node.entry.directory) {
      const children = [...this.nodes.values()]
        .filter(item => samePath(dirname(item.entry.path), node.entry.path) && !samePath(item.entry.path, node.entry.path))
        .sort((a, b) => a.entry.directory !== b.entry.directory ? (a.entry.directory ? -1 : 1) : a.entry.name.localeCompare(b.entry.name, undefined, { sensitivity: "base" }));
      for (const child of children) {
        wrapper.append(this.renderNode(child.entry.path, depth + 1));
      }
    }
    return wrapper;
  }

  private async openNode(node: TreeNode): Promise<void> {
    if (this.disposed) return;
    if (node.entry.directory) {
      node.expanded = !node.expanded;
      if (node.expanded) {
        try {
          await this.loadChildren(node.entry.path, true);
          if (this.disposed) return;
        } catch (error) {
          if (this.disposed) return;
          node.expanded = false;
          reportError(error, this.updateStatus, `Nao foi possivel listar pasta (${node.entry.path})`);
        }
      }
      this.render();
      return;
    }
    this.onFileOpen(node.entry.path);
  }

  private showMenu(node: TreeNode, x: number, y: number): void {
    const isLiveServerSupported = /\.(html?|php)$/i.test(node.entry.name) && !node.entry.directory;
    contextMenu([
      { label: node.entry.directory ? "Abrir pasta" : "Abrir arquivo", action: () => void this.openNode(node) },
      {
        label: "Open with Live Server",
        disabled: !isLiveServerSupported,
        action: () => void this.openLiveServer(node.entry.path)
      },
      { label: "Novo arquivo", action: () => void this.createIn(node.entry.directory ? node.entry.path : dirname(node.entry.path), false) },
      { label: "Nova pasta", action: () => void this.createIn(node.entry.directory ? node.entry.path : dirname(node.entry.path), true) },
      { label: "Renomear", action: () => void this.rename(node.entry.path) },
      { label: "Excluir", danger: true, action: () => void this.delete(node.entry.path) },
      { label: "Copiar caminho", action: () => this.copyToClipboard(node.entry.path) },
      { label: "Copiar caminho relativo", action: () => this.copyToClipboard(this.root ? relativePath(this.root, node.entry.path) : node.entry.path) },
      { label: "Atualizar", action: () => void this.refresh() }
    ], x, y);
  }

  private async createInSelected(folder: boolean): Promise<void> {
    const selected = this.selectedPath ? this.nodes.get(this.selectedPath) : undefined;
    await this.createIn(selected?.entry.directory ? selected.entry.path : selected ? dirname(selected.entry.path) : this.root, folder);
  }

  private async createIn(baseDir: string | undefined, folder: boolean): Promise<void> {
    if (this.disposed) return;
    if (!baseDir) return;
    const name = prompt(folder ? "Nome da pasta" : "Nome do arquivo", folder ? "New Folder" : "untitled");
    if (!name?.trim()) return;
    const target = joinPath(baseDir, name.trim());
    try {
      if (folder) await api.fs.createFolder(target);
      else {
        await api.fs.createFile(target);
        if (this.disposed) return;
        this.onFileOpen(target);
      }
      if (this.disposed) return;
      await this.refresh();
    } catch (error) {
      if (this.disposed) return;
      reportError(error, this.updateStatus, "Nao foi possivel criar");
    }
  }

  private async rename(filePath: string): Promise<void> {
    if (this.disposed) return;
    const name = prompt("Novo nome", basename(filePath));
    if (!name?.trim() || name === basename(filePath)) return;
    const target = joinPath(dirname(filePath), name.trim());
    try {
      await api.fs.rename(filePath, target);
      if (this.disposed) return;
      await this.refresh();
    } catch (error) {
      if (this.disposed) return;
      reportError(error, this.updateStatus, "Nao foi possivel renomear");
    }
  }

  private async delete(filePath: string): Promise<void> {
    if (this.disposed) return;
    if (!confirm(`Excluir "${basename(filePath)}"?`)) return;
    try {
      await api.fs.delete(filePath);
      if (this.disposed) return;
      await this.refresh();
    } catch (error) {
      if (this.disposed) return;
      reportError(error, this.updateStatus, "Nao foi possivel excluir");
    }
  }

  private async openLiveServer(filePath: string): Promise<void> {
    if (this.disposed) return;
    if (!this.root) return;
    try {
      const result = await api.liveServer.open({ workspace: this.root, filePath });
      if (this.disposed) return;
      if (result.url) {
        window.open(result.url, "_blank", "noopener,noreferrer");
      }
      this.updateStatus(result.output);
    } catch (error) {
      if (this.disposed) return;
      reportError(error, this.updateStatus, "Open with Live Server failed");
    }
  }

  private watchFolder(folder: string | undefined): void {
    this.stopWatching();
    if (!folder || this.disposed) return;
    this.unwatchWorkspace = api.fs.watch(folder, event => this.handleWorkspaceChange(event));
  }

  private stopWatching(): void {
    if (this.refreshTimer !== undefined) {
      window.clearTimeout(this.refreshTimer);
      this.refreshTimer = undefined;
    }
    this.unwatchWorkspace?.();
    this.unwatchWorkspace = undefined;
  }

  private handleWorkspaceChange(event: WorkspaceChangeEvent): void {
    if (this.disposed) return;
    if (!this.root || !samePath(event.root, this.root)) return;
    if (event.error) {
      console.warn(`[NPSharp explorer] Workspace watcher reported an error (${event.root})`, event.error);
    }
    if (this.refreshTimer !== undefined) window.clearTimeout(this.refreshTimer);
    this.refreshTimer = window.setTimeout(() => {
      this.refreshTimer = undefined;
      if (this.disposed) return;
      void this.refresh({ silent: true });
    }, 300);
  }

  private copyToClipboard(text: string): void {
    if (this.disposed) return;
    void navigator.clipboard.writeText(text).catch(error => {
      if (this.disposed) return;
      reportError(error, this.updateStatus, "Nao foi possivel copiar caminho");
    });
  }
}
