import type { WorkspaceChangeEvent, WorkspaceEntry } from "../../shared/types";
import { initialContentForNewNPSharpFile } from "../../core/easterEggs";
import { api, platform } from "../services/api";
import { buttonIcon, contextMenu, el, fileIcon } from "../utils/dom";
import { reportError } from "../utils/errors";
import { basename, dirname, isSubPath, joinPath, normalizePath, pathSeparator, relativePath, samePath } from "../utils/path";

interface TreeNode {
  entry: WorkspaceEntry;
  childrenLoaded: boolean;
  expanded: boolean;
}

type CreateKind = "file" | "folder";

interface PendingCreate {
  workspace: string;
  baseDir: string;
  kind: CreateKind;
  value: string;
  creating: boolean;
  error?: string;
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
  private pendingCreate?: PendingCreate;
  private createInput?: HTMLInputElement;
  private focusPendingCreateInput = false;
  private deleteDialog?: HTMLElement;

  onWorkspaceChanged: (workspace?: string) => void = () => undefined;

  constructor(
    private readonly onFileOpen: (filePath: string) => void,
    private readonly updateStatus: (text: string) => void,
    private readonly shouldConfirmDelete: () => boolean,
    private readonly setConfirmDelete: (value: boolean) => Promise<void>
  ) {
    this.build();
  }


  get workspace(): string | undefined {
    return this.root;
  }

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    this.cancelCreate();
    this.closeDeleteDialog();
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
      const selectedPath = this.selectedPath;
      if (selectedPath) {
        for (const ancestor of this.ancestorsOf(selectedPath)) expanded.add(ancestor);
      }
      const root = this.root;
      this.nodes = new Map();
      this.nodes.set(root, { entry: { path: root, name: basename(root), directory: true, size: 0, modifiedAt: 0, hidden: false }, childrenLoaded: false, expanded: true });
      await this.loadChildren(root, true);
      if (this.disposed) return;
      for (const item of [...expanded].sort((left, right) => this.ancestorsOf(left).length - this.ancestorsOf(right).length)) {
        const node = this.nodes.get(item);
        if (node?.entry.directory) {
          node.expanded = true;
          await this.loadChildren(item, true);
          if (this.disposed) return;
        }
      }
      if (this.selectedPath && !this.nodes.has(this.selectedPath)) this.selectedPath = this.root;
      this.render();
      if (!options.silent) this.updateStatus("Explorador atualizado");
    } catch (error) {
      reportError(error, this.updateStatus, "Não foi possível atualizar o Explorador");
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
      buttonIcon("new-file", "Novo arquivo", () => this.createInSelected("file")),
      buttonIcon("new-folder", "Nova pasta", () => this.createInSelected("folder")),
      buttonIcon("trash", "Excluir item selecionado", () => void this.deleteSelected()),
      buttonIcon("refresh", "Atualizar", () => void this.refresh()),
      buttonIcon("collapse-all", "Recolher tudo", () => this.collapseAll())
    );
    this.tree.tabIndex = 0;
    this.tree.setAttribute("role", "tree");
    this.tree.setAttribute("aria-label", "Árvore de arquivos");
    this.tree.addEventListener("keydown", event => {
      if (event.target instanceof HTMLInputElement || (event.key !== "Delete" && event.key !== "Backspace")) return;
      event.preventDefault();
      void this.deleteSelected();
    });

    const title = el("div", { className: "empty-title", text: platform.isMobile ? "Nenhum workspace mobile aberto" : "Nenhuma pasta aberta" });
    const subtitle = el("div", {
      className: "empty-subtitle",
      text: platform.isMobile ? "Abra um workspace mobile no sandbox do app." : "Abra uma pasta para exibir os arquivos no Explorer."
    });
    const open = el("button", { className: "primary", text: platform.isMobile ? "Abrir workspace mobile" : "Abrir pasta" });
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
    this.focusInlineCreateInput();
  }

  private renderNode(nodePath: string, depth: number): HTMLElement {
    const node = this.nodes.get(nodePath)!;
    const row = el("div", { className: `tree-row${samePath(this.selectedPath ?? "", nodePath) ? " selected" : ""}`, attrs: { "data-path": nodePath } });
    row.style.paddingLeft = `${depth * 14 + 6}px`;
    const twisty = el("span", { className: "tree-twisty", text: node.entry.directory ? (node.expanded ? "▾" : "▸") : "" });
    row.append(twisty, fileIcon(node.entry.name, node.entry.directory, node.expanded), el("span", { className: "tree-label", text: node.entry.name }));

    row.addEventListener("click", () => {
      this.selectedPath = node.entry.path;
      this.tree.focus({ preventScroll: true });
      void this.openNode(node);
    });
    row.addEventListener("contextmenu", event => {
      event.preventDefault();
      this.selectedPath = node.entry.path;
      this.render();
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
      if (this.pendingCreate && samePath(this.pendingCreate.baseDir, node.entry.path)) {
        wrapper.append(this.renderCreateInput(depth + 1));
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
    const isWorkspaceRoot = Boolean(this.root && samePath(node.entry.path, this.root));
    contextMenu([
      { label: node.entry.directory ? "Abrir pasta" : "Abrir arquivo", action: () => void this.openNode(node) },
      {
        label: "Abrir com Live Server",
        disabled: !isLiveServerSupported,
        action: () => void this.openLiveServer(node.entry.path)
      },
      { label: "Novo arquivo", action: () => this.createIn(node.entry.directory ? node.entry.path : dirname(node.entry.path), "file") },
      { label: "Nova pasta", action: () => this.createIn(node.entry.directory ? node.entry.path : dirname(node.entry.path), "folder") },
      { label: "Renomear", disabled: isWorkspaceRoot, action: () => void this.rename(node.entry.path) },
      { label: "Excluir", disabled: isWorkspaceRoot, danger: true, action: () => void this.delete(node.entry.path) },
      { label: "Copiar caminho", action: () => this.copyToClipboard(node.entry.path) },
      { label: "Copiar caminho relativo", action: () => this.copyToClipboard(this.root ? relativePath(this.root, node.entry.path) : node.entry.path) },
      { label: "Atualizar", action: () => void this.refresh() }
    ], x, y);
  }

  private createInSelected(kind: CreateKind): void {
    const selected = this.selectedPath ? this.nodes.get(this.selectedPath) : undefined;
    this.createIn(selected?.entry.directory ? selected.entry.path : selected ? dirname(selected.entry.path) : this.root, kind);
  }

  /** Both file and folder commands intentionally use this one inline editor flow. */
  private createIn(baseDir: string | undefined, kind: CreateKind): void {
    if (this.disposed) return;
    if (!baseDir || !this.root) {
      this.updateStatus("Abra uma pasta antes de criar arquivos ou pastas.");
      return;
    }
    const node = this.nodes.get(baseDir);
    if (node?.entry.directory) {
      node.expanded = true;
      void this.loadChildren(baseDir, true).then(() => this.render()).catch(error => {
        reportError(error, this.updateStatus, "Não foi possível preparar a pasta para criação");
      });
    }
    this.pendingCreate = { workspace: this.root, baseDir, kind, value: "", creating: false };
    this.selectedPath = baseDir;
    this.focusPendingCreateInput = true;
    this.render();
  }

  private renderCreateInput(depth: number): HTMLElement {
    const pending = this.pendingCreate!;
    const row = el("div", { className: `tree-row tree-create-row${pending.error ? " has-error" : ""}` });
    row.style.paddingLeft = `${depth * 14 + 6}px`;
    const twisty = el("span", { className: "tree-twisty" });
    const input = el("input", {
      className: "tree-create-input",
      attrs: {
        value: pending.value,
        placeholder: pending.kind === "folder" ? "Nova pasta" : "Novo arquivo",
        autocomplete: "off",
        spellcheck: "false",
        "aria-label": pending.kind === "folder" ? "Nome da nova pasta" : "Nome do novo arquivo"
      }
    });
    if (pending.error) {
      input.title = pending.error;
      input.setAttribute("aria-invalid", "true");
    }
    input.disabled = pending.creating;
    input.addEventListener("input", () => {
      if (this.pendingCreate) {
        this.pendingCreate.value = input.value;
        this.pendingCreate.error = undefined;
      }
    });
    input.addEventListener("keydown", event => {
      if (event.key === "Enter") {
        event.preventDefault();
        void this.submitInlineCreate();
      } else if (event.key === "Escape") {
        event.preventDefault();
        this.cancelCreate();
      }
    });
    input.addEventListener("blur", () => {
      window.setTimeout(() => {
        if (this.createInput !== input || !this.pendingCreate || this.pendingCreate.creating) return;
        if (input.value.trim()) void this.submitInlineCreate();
        else this.cancelCreate();
      }, 0);
    });
    this.createInput = input;
    row.append(twisty, fileIcon(pending.kind === "folder" ? "new-folder" : "new-file", pending.kind === "folder"), input);
    return row;
  }

  private async submitInlineCreate(): Promise<void> {
    const pending = this.pendingCreate;
    if (!pending || pending.creating || this.disposed) return;
    const name = pending.value.trim();
    if (!name) {
      this.cancelCreate();
      return;
    }
    pending.error = undefined;
    pending.creating = true;
    this.render();
    try {
      const target = this.workspaceTarget(pending.baseDir, name);
      if (pending.kind === "folder") await api.fs.createFolderInWorkspace({ workspace: pending.workspace, path: target });
      else await api.fs.createFileInWorkspace({
        workspace: pending.workspace,
        path: target,
        initialContent: initialContentForNewNPSharpFile(name)
      });
      if (this.disposed) return;
      this.expandPath(dirname(target));
      this.selectedPath = target;
      this.pendingCreate = undefined;
      this.createInput = undefined;
      await this.refresh();
      await this.revealFile(target);
      if (pending.kind === "file" && !this.disposed) this.onFileOpen(target);
      this.updateStatus(pending.kind === "folder" ? "Pasta criada" : "Arquivo criado");
    } catch (error) {
      if (this.disposed) return;
      const detail = error instanceof Error ? error.message : String(error);
      pending.error = detail || `Não foi possível criar ${pending.kind === "folder" ? "a pasta" : "o arquivo"}.`;
      pending.creating = false;
      this.focusPendingCreateInput = true;
      this.render();
    } finally {
      if (this.pendingCreate === pending) pending.creating = false;
    }
  }

  private cancelCreate(): void {
    this.pendingCreate = undefined;
    this.createInput = undefined;
    this.render();
  }

  private focusInlineCreateInput(): void {
    if (!this.focusPendingCreateInput) return;
    this.focusPendingCreateInput = false;
    const focus = () => {
      const input = this.createInput;
      if (!input?.isConnected) return;
      input.focus({ preventScroll: true });
      input.select();
    };
    requestAnimationFrame(focus);
    window.setTimeout(focus, 0);
  }

  private async rename(filePath: string): Promise<void> {
    if (this.disposed) return;
    if (!this.root || samePath(filePath, this.root)) return;
    const name = prompt("Novo nome", basename(filePath));
    if (!name?.trim() || name === basename(filePath)) return;
    try {
      const target = this.workspaceTarget(dirname(filePath), name);
      await api.fs.renameInWorkspace({ workspace: this.root, path: filePath, newPath: target });
      if (this.disposed) return;
      if (this.selectedPath && isSubPath(filePath, this.selectedPath)) {
        this.selectedPath = joinPath(target, relativePath(filePath, this.selectedPath));
      }
      await this.refresh();
      this.updateStatus("Item renomeado");
    } catch (error) {
      if (this.disposed) return;
      reportError(error, this.updateStatus, "Não foi possível renomear");
    }
  }

  private async delete(filePath: string): Promise<void> {
    if (this.disposed || !this.root || samePath(filePath, this.root)) return;
    if (this.shouldConfirmDelete()) {
      this.showDeleteDialog(filePath);
      return;
    }
    try {
      await this.deleteItem(filePath);
    } catch {
      // The operation already reported a useful error in the status bar.
    }
  }

  private async deleteSelected(): Promise<void> {
    const selected = this.selectedPath;
    if (!selected || !this.root || samePath(selected, this.root)) {
      this.updateStatus("Selecione um arquivo ou pasta para excluir.");
      return;
    }
    await this.delete(selected);
  }

  private showDeleteDialog(filePath: string): void {
    this.closeDeleteDialog();
    const overlay = el("div", { className: "file-delete-overlay" });
    const dialog = el("form", { className: "file-delete-dialog", attrs: { "aria-label": "Confirmar exclusão" } });
    const title = el("h2", { text: `Excluir ${basename(filePath)}?` });
    const description = el("p", { text: "Esta ação removerá o item do disco." });
    const remember = el("input", { attrs: { type: "checkbox" } }) as HTMLInputElement;
    const rememberLabel = el("label", { className: "file-delete-remember", children: [remember, " Não perguntar novamente"] });
    const error = el("div", { className: "file-delete-error", attrs: { role: "alert", "aria-live": "polite" } });
    const cancel = el("button", { className: "secondary", text: "Cancelar", attrs: { type: "button" } });
    const submit = el("button", { className: "danger", text: "Excluir", attrs: { type: "submit" } });
    const actions = el("div", { className: "file-delete-actions", children: [cancel, submit] });
    dialog.append(title, description, rememberLabel, error, actions);
    overlay.append(dialog);

    const close = () => this.closeDeleteDialog();
    cancel.addEventListener("click", close);
    overlay.addEventListener("pointerdown", event => {
      if (event.target === overlay) close();
    });
    overlay.addEventListener("keydown", event => {
      if (event.key === "Escape") {
        event.preventDefault();
        close();
      }
    });
    dialog.addEventListener("submit", event => {
      event.preventDefault();
      submit.disabled = true;
      cancel.disabled = true;
      void this.deleteItem(filePath)
        .then(async () => {
          this.closeDeleteDialog();
          if (!remember.checked) return;
          try {
            await this.setConfirmDelete(false);
          } catch (preferenceError) {
            reportError(preferenceError, this.updateStatus, "O item foi excluído, mas não foi possível salvar a preferência de confirmação");
          }
        })
        .catch(errorValue => {
          error.textContent = errorValue instanceof Error ? errorValue.message : String(errorValue);
          submit.disabled = false;
          cancel.disabled = false;
        });
    });

    this.deleteDialog = overlay;
    document.body.append(overlay);
    requestAnimationFrame(() => submit.focus());
  }

  private async deleteItem(filePath: string): Promise<void> {
    if (this.disposed || !this.root || samePath(filePath, this.root)) return;
    try {
      const parent = dirname(filePath);
      await api.fs.deleteInWorkspace({ workspace: this.root, path: filePath });
      if (this.disposed) return;
      if (this.selectedPath && isSubPath(filePath, this.selectedPath)) this.selectedPath = parent;
      await this.refresh();
      this.updateStatus("Item excluído");
    } catch (error) {
      if (this.disposed) return;
      reportError(error, this.updateStatus, "Não foi possível excluir");
      throw error;
    }
  }

  private closeDeleteDialog(): void {
    this.deleteDialog?.remove();
    this.deleteDialog = undefined;
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
      reportError(error, this.updateStatus, "Não foi possível abrir com Live Server");
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
      reportError(error, this.updateStatus, "Não foi possível copiar o caminho");
    });
  }

  private workspaceTarget(baseDir: string, rawName: string): string {
    const value = rawName.trim().replace(/\\/g, "/");
    if (!value || value.startsWith("/") || /^[A-Za-z]:\//.test(value)) throw new Error("Informe um caminho relativo válido.");
    const segments = value.split("/");
    if (segments.some(segment => !segment || segment === "." || segment === "..")) {
      throw new Error("O caminho não pode conter segmentos vazios, '.' ou '..'.");
    }
    if (segments.some(segment => /[<>:"|?*\u0000-\u001F]/.test(segment))) {
      throw new Error("O nome contém caracteres inválidos.");
    }
    const target = joinPath(baseDir, ...segments);
    if (!this.root || !isSubPath(this.root, target)) throw new Error("O item deve permanecer dentro do workspace aberto.");
    return target;
  }

  private expandPath(targetPath: string): void {
    for (const ancestor of this.ancestorsOf(targetPath)) {
      const node = this.nodes.get(ancestor);
      if (node?.entry.directory) node.expanded = true;
    }
  }

  private ancestorsOf(targetPath: string): string[] {
    if (!this.root || !isSubPath(this.root, targetPath)) return [];
    const ancestors: string[] = [];
    let current = normalizePath(targetPath);
    while (true) {
      ancestors.unshift(current);
      if (samePath(current, this.root)) return ancestors;
      const parent = dirname(current);
      if (samePath(parent, current)) return ancestors;
      current = parent;
    }
  }
}
