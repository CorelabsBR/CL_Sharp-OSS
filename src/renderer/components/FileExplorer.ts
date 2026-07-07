import type { WorkspaceEntry } from "../../shared/types";
import { api } from "../services/api";
import { buttonIcon, contextMenu, el, fileIcon } from "../utils/dom";
import { reportError } from "../utils/errors";
import { basename, dirname, isSubPath, joinPath, relativePath } from "../utils/path";

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
  private nodes = new Map<string, TreeNode>();

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

  async openFolderFromDialog(): Promise<void> {
    const result = await api.dialog.openFolder();
    if (!result.canceled && result.paths[0]) {
      await this.openFolder(result.paths[0]);
    }
  }

  async openFolder(folder: string): Promise<void> {
    this.root = folder;
    this.nodes.clear();
    const rootEntry: WorkspaceEntry = { path: folder, name: basename(folder), directory: true, size: 0, modifiedAt: 0, hidden: false };
    this.nodes.set(folder, { entry: rootEntry, childrenLoaded: false, expanded: true });
    this.onWorkspaceChanged(folder);
    await this.loadChildren(folder);
    this.render();
    this.updateStatus(`Workspace aberto: ${folder}`);
  }

  clearFolder(): void {
    this.root = undefined;
    this.nodes.clear();
    this.onWorkspaceChanged(undefined);
    this.render();
  }

  async refresh(): Promise<void> {
    if (!this.root) {
      this.render();
      return;
    }
    const expanded = new Set([...this.nodes.values()].filter(node => node.expanded).map(node => node.entry.path));
    const root = this.root;
    this.nodes.clear();
    this.nodes.set(root, { entry: { path: root, name: basename(root), directory: true, size: 0, modifiedAt: 0, hidden: false }, childrenLoaded: false, expanded: true });
    await this.loadChildren(root);
    for (const item of expanded) {
      const node = this.nodes.get(item);
      if (node?.entry.directory) {
        node.expanded = true;
        await this.loadChildren(item);
      }
    }
    this.render();
  }

  collapseAll(): void {
    for (const node of this.nodes.values()) {
      node.expanded = node.entry.path === this.root;
    }
    this.render();
  }

  async revealFile(filePath: string): Promise<void> {
    if (!this.root || !isSubPath(this.root, filePath)) return;
    const segments = relativePath(this.root, dirname(filePath)).split("/").filter(Boolean);
    let current = this.root;
    for (const segment of segments) {
      current = joinPath(current, segment);
      const node = this.nodes.get(current);
      if (node) {
        node.expanded = true;
        await this.loadChildren(current);
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

    const title = el("div", { className: "empty-title", text: "Nenhuma pasta aberta" });
    const subtitle = el("div", { className: "empty-subtitle", text: "Abra uma pasta para exibir os arquivos no Explorer." });
    const open = el("button", { className: "primary", text: "Open Folder" });
    open.addEventListener("click", () => void this.openFolderFromDialog());
    this.empty.append(title, subtitle, open);
    this.element.append(this.toolbar, this.tree, this.empty);
    this.render();
  }

  private async loadChildren(dir: string): Promise<void> {
    const node = this.nodes.get(dir);
    if (!node || node.childrenLoaded || !node.entry.directory) return;
    const entries = await api.fs.listDir(dir);
    for (const entry of entries) {
      this.nodes.set(entry.path, this.nodes.get(entry.path) ?? { entry, childrenLoaded: false, expanded: false });
    }
    node.childrenLoaded = true;
  }

  private render(): void {
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
    const row = el("div", { className: "tree-row", attrs: { "data-path": nodePath } });
    row.style.paddingLeft = `${depth * 14 + 6}px`;
    const twisty = el("span", { className: "tree-twisty", text: node.entry.directory ? (node.expanded ? "▾" : "▸") : "" });
    row.append(twisty, fileIcon(node.entry.name, node.entry.directory, node.expanded), el("span", { className: "tree-label", text: node.entry.name }));

    row.addEventListener("click", () => void this.openNode(node));
    row.addEventListener("contextmenu", event => {
      event.preventDefault();
      this.showMenu(node, event.clientX, event.clientY);
    });

    const wrapper = el("div", { className: "tree-node" });
    wrapper.append(row);
    if (node.expanded && node.entry.directory) {
      const children = [...this.nodes.values()]
        .filter(item => dirname(item.entry.path) === node.entry.path && item.entry.path !== node.entry.path)
        .sort((a, b) => a.entry.directory !== b.entry.directory ? (a.entry.directory ? -1 : 1) : a.entry.name.localeCompare(b.entry.name, undefined, { sensitivity: "base" }));
      for (const child of children) {
        wrapper.append(this.renderNode(child.entry.path, depth + 1));
      }
    }
    return wrapper;
  }

  private async openNode(node: TreeNode): Promise<void> {
    if (node.entry.directory) {
      node.expanded = !node.expanded;
      if (node.expanded) await this.loadChildren(node.entry.path);
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
      { label: "Copiar caminho", action: () => void navigator.clipboard.writeText(node.entry.path) },
      { label: "Copiar caminho relativo", action: () => void navigator.clipboard.writeText(this.root ? relativePath(this.root, node.entry.path) : node.entry.path) },
      { label: "Atualizar", action: () => void this.refresh() }
    ], x, y);
  }

  private async createInSelected(folder: boolean): Promise<void> {
    await this.createIn(this.root, folder);
  }

  private async createIn(baseDir: string | undefined, folder: boolean): Promise<void> {
    if (!baseDir) return;
    const name = prompt(folder ? "Nome da pasta" : "Nome do arquivo", folder ? "New Folder" : "untitled");
    if (!name?.trim()) return;
    const target = joinPath(baseDir, name.trim());
    try {
      if (folder) await api.fs.createFolder(target);
      else {
        await api.fs.createFile(target);
        this.onFileOpen(target);
      }
      await this.refresh();
    } catch (error) {
      reportError(error, this.updateStatus, "Nao foi possivel criar");
    }
  }

  private async rename(filePath: string): Promise<void> {
    const name = prompt("Novo nome", basename(filePath));
    if (!name?.trim() || name === basename(filePath)) return;
    const target = joinPath(dirname(filePath), name.trim());
    try {
      await api.fs.rename(filePath, target);
      await this.refresh();
    } catch (error) {
      reportError(error, this.updateStatus, "Nao foi possivel renomear");
    }
  }

  private async delete(filePath: string): Promise<void> {
    if (!confirm(`Excluir "${basename(filePath)}"?`)) return;
    try {
      await api.fs.delete(filePath);
      await this.refresh();
    } catch (error) {
      reportError(error, this.updateStatus, "Nao foi possivel excluir");
    }
  }

  private async openLiveServer(filePath: string): Promise<void> {
    if (!this.root) return;
    const result = await api.liveServer.open({ workspace: this.root, filePath });
    this.updateStatus(result.output);
  }
}
