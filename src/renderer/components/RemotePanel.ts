/*---------------------------------------------------------------------------------------------
- Copyright (c) CorelabsBR. All rights reserved.
- Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
import type { RemoteHostConfig, WorkspaceEntry } from "../../shared/types";
import { api } from "../services/api";
import { buttonIcon, contextMenu, el, fileIcon } from "../utils/dom";
import { reportError } from "../utils/errors";
import { basename } from "../utils/path";
import { showInputDialog } from "../utils/inputDialog";

export class RemotePanel {
  readonly element = el("div", { className: "panel remote-panel" });
  private readonly hostsBox = el("div", { className: "remote-hosts" });
  private readonly tree = el("div", { className: "remote-tree" });
  private readonly command = el("input", { className: "panel-input", attrs: { placeholder: "Comando remoto" } });
  private hosts: RemoteHostConfig[] = [];
  private active?: RemoteHostConfig;
  private password = "";
  private currentPath = ".";
  private sessionId?: string;
  private connecting = false;
  private disposeStatus?: () => void;
  private watcherId?: string;

  constructor(
    private readonly openVirtualFile: (title: string, uri: string, content: string, save: (content: string) => Promise<void>) => void,
    private readonly updateStatus: (text: string) => void,
    private readonly openWorkspace?: (uri: string, name: string, location: string) => Promise<void>
  ) {
    this.build();
  }

  async refresh(): Promise<void> {
    this.hosts = await api.remote.loadHosts();
    this.renderHosts();
  }

  async connectSavedHost(): Promise<void> {
    await this.refresh();
    if (!this.hosts.length) { this.updateStatus("Nenhum Remote Host configurado"); return; }
    const selected = await showInputDialog(`Remote Host: Connect — ${this.hosts.map(host => host.name || host.host).join(", ")}`, this.hosts[0]?.name ?? "");
    const host = this.hosts.find(item => selected === item.name || selected === item.host);
    if (!host) { this.updateStatus("Host remoto não encontrado"); return; }
    await this.connect(host);
  }

  async disconnect(): Promise<void> { if (!this.sessionId) return; await api.remote.disconnect(this.sessionId); this.sessionId = undefined; this.watcherId = undefined; this.active = undefined; this.tree.replaceChildren(); this.renderHosts(); }
  async reconnect(): Promise<void> { if (!this.sessionId) return; const session = await api.remote.reconnect(this.sessionId); this.sessionId = session.id; await this.openRemoteFolder(); }
  async openRemoteFolder(): Promise<void> { if (!this.sessionId || !this.active) return; const selected = await this.pickRemoteFolder(this.currentPath); if (!selected) return; await this.activateRemoteFolder(selected); }
  async showLogs(): Promise<void> { const logs = await api.remote.getLogs(); this.updateStatus(logs.slice(-20).map(entry => `${entry.timestamp} [${entry.scope}] ${entry.message}`).join("\n") || "Sem logs remotos"); }
  async addNewHost(): Promise<void> { await this.addHost(); }
  async editSelectedHost(): Promise<void> { const host = this.active ?? this.hosts[0]; if (host) await this.editHost(host); }
  async removeSelectedHost(): Promise<void> { const host = this.active ?? this.hosts[0]; if (host) await this.deleteHost(host); }
  async uninstallServer(): Promise<void> { if (!this.sessionId || !confirm("Desinstalar esta versão do NPSharp Server no host remoto?")) return; await api.remote.uninstallServer(this.sessionId); this.sessionId = undefined; this.active = undefined; this.tree.replaceChildren(); this.renderHosts(); }

  connection(): { sessionId: string; hostName: string; cwd: string; shell?: string } | undefined {
    return this.sessionId && this.active ? { sessionId: this.sessionId, hostName: this.active.name || this.active.host, cwd: this.currentPath } : undefined;
  }

  private build(): void {
    const toolbar = el("div", { className: "panel-toolbar" });
    toolbar.append(
      buttonIcon("add", "Add Host", () => void this.addHost()),
      buttonIcon("refresh", "Atualizar", () => void this.refresh()),
      buttonIcon("terminal", "Execute", () => void this.executeCommand())
    );
    this.command.addEventListener("keydown", event => {
      if (event.key === "Enter") void this.executeCommand();
    });
    this.element.append(toolbar, this.hostsBox, this.command, this.tree);
    this.disposeStatus = api.remote.onStatusChanged(state => this.updateStatus(state.message));
    api.remote.onEvent(value => {
      const payload = value.payload as { watcherId?: string };
      if (value.sessionId === this.sessionId && payload.watcherId === this.watcherId && value.event.startsWith("fs.")) void this.list(this.currentPath);
    });
    void this.refresh();
  }

  private renderHosts(): void {
    this.hostsBox.replaceChildren();
    for (const host of this.hosts) {
      const button = el("button", { className: `remote-host ${host === this.active ? "active" : ""}`, text: host.name || `${host.username}@${host.host}` });
      button.addEventListener("click", () => void this.connect(host));
      button.addEventListener("contextmenu", event => {
        event.preventDefault();
        contextMenu([
          { label: "Conectar", action: () => void this.connect(host) },
          { label: "Testar", action: () => void this.testHost(host) },
          { label: "Editar", action: () => void this.editHost(host) },
          { label: "Excluir", danger: true, action: () => void this.deleteHost(host) }
        ], event.clientX, event.clientY);
      });
      this.hostsBox.append(button);
    }
  }

  private async addHost(): Promise<void> {
    const config = await this.promptHost();
    if (!config) return;
    this.hosts.push(config);
    await api.remote.saveHosts(this.hosts);
    await this.refresh();
  }

  private async editHost(host: RemoteHostConfig): Promise<void> {
    const next = await this.promptHost(host);
    if (!next) return;
    const index = this.hosts.indexOf(host);
    if (index >= 0) this.hosts[index] = next;
    if (this.active === host) this.active = next;
    await api.remote.saveHosts(this.hosts);
    await this.refresh();
  }

  private async deleteHost(host: RemoteHostConfig): Promise<void> {
    if (!confirm(`Delete remote host ${host.name || host.host}?`)) return;
    this.hosts = this.hosts.filter(item => item !== host);
    if (this.active === host) {
      this.active = undefined;
      this.tree.replaceChildren();
    }
    await api.remote.saveHosts(this.hosts);
    this.renderHosts();
  }

  private async testHost(host: RemoteHostConfig): Promise<void> {
    const password = host.authMethod === "password" ? await showInputDialog(`Senha para ${host.username}@${host.host}`, "", { password: true }) ?? "" : undefined;
    const result = await this.testAndTrust(host, password);
    this.updateStatus(result.output || (result.success ? "Host remoto conectado" : "Falha no teste do host remoto"));
  }

  private async promptHost(existing?: RemoteHostConfig): Promise<RemoteHostConfig | undefined> {
    const host = await showInputDialog("Host", existing?.host ?? "");
    if (!host?.trim()) return undefined;
    const username = await showInputDialog("Username", existing?.username ?? "") ?? "";
    if (!username.trim()) return undefined;
    const portText = await showInputDialog("Porta SSH", String(existing?.port ?? 22)) ?? "22";
    const authInput = await showInputDialog("Autenticação: password, key ou agent", existing?.authMethod ?? "password") ?? "password";
    const authMethod = normalizeAuth(authInput);
    const privateKeyPath = authMethod === "key" ? await showInputDialog("Caminho da chave privada", existing?.privateKeyPath ?? "") ?? "" : "";
    const defaultPath = await showInputDialog("Caminho remoto padrão", existing?.defaultPath ?? ".") ?? ".";
    const name = await showInputDialog("Nome do host", existing?.name ?? `${username}@${host}`) ?? `${username}@${host}`;
    return {
      name: name.trim() || `${username}@${host}`,
      host: host.trim(),
      port: Number(portText) || 22,
      username: username.trim(),
      authMethod,
      privateKeyPath,
      defaultPath: defaultPath.trim() || "."
    };
  }

  private async connect(host: RemoteHostConfig): Promise<void> {
    if (this.connecting) {
      this.updateStatus("Conexão remota já está em andamento...");
      return;
    }
    this.connecting = true;
    this.active = host;
    try {
      if (host.authMethod === "password") {
        this.password = await showInputDialog(`Senha para ${host.username}@${host.host}`, "", { password: true }) ?? "";
      }
      const tested = await this.testAndTrust(host, this.password || undefined);
      if (!tested.success) {
        this.updateStatus(tested.output || "Falha ao conectar ao host remoto");
        return;
      }
      const session = await api.remote.connect(host.id!, this.password || undefined);
      this.sessionId = session.id;
      this.currentPath = host.defaultPath || session.platform.homeDirectory;
      this.renderHosts();
      const selected = await this.pickRemoteFolder(this.currentPath);
      if (selected) await this.activateRemoteFolder(selected);
      else this.updateStatus(`Conectado a ${session.hostName}; nenhuma pasta remota foi aberta.`);
    } catch (error) {
      reportError(error, this.updateStatus, "Falha ao conectar ao NPSharp Server");
    } finally {
      this.password = "";
      this.connecting = false;
    }
  }

  private async activateRemoteFolder(remotePath: string): Promise<void> {
    if (!this.sessionId || !this.active) return;
    if (this.watcherId) await api.remote.sendRpc(this.sessionId, "fs.unwatch", { id: this.watcherId }).catch(() => undefined);
    this.currentPath = remotePath.replace(/\/$/, "") || "/";
    const workspaceUri = await api.remote.openFolder(this.sessionId, this.currentPath);
    this.watcherId = (await api.remote.sendRpc<{ id: string }>(this.sessionId, "fs.watch", { path: this.currentPath, recursive: true })).id;
    const hostName = this.active.name || this.active.host;
    await this.openWorkspace?.(workspaceUri, `${hostName} — ${basename(this.currentPath) || "/"}`, `${hostName}:${this.currentPath}`);
    await this.list(this.currentPath);
  }

  private pickRemoteFolder(initialPath: string): Promise<string | undefined> {
    return new Promise(resolve => {
      if (!this.sessionId) { resolve(undefined); return; }
      const sessionId = this.sessionId;
      const overlay = el("div", { className: "runtime-config-overlay remote-folder-overlay", attrs: { tabindex: "-1" } });
      const dialog = el("section", { className: "remote-folder-dialog", attrs: { role: "dialog", "aria-modal": "true", "aria-label": "Abrir pasta remota" } });
      const title = el("div", { className: "remote-folder-title", children: [el("h2", { text: "Abrir pasta no host remoto" }), el("span", { text: this.active ? `${this.active.username}@${this.active.host}` : "Remote Host" })] });
      const input = el("input", { className: "panel-input remote-folder-input", attrs: { value: `${initialPath.replace(/\/$/, "") || "/"}/`, placeholder: "/home/usuário/projeto", autocomplete: "off", spellcheck: "false" } });
      const status = el("div", { className: "remote-folder-status", text: "Digite um caminho ou escolha uma pasta abaixo." });
      const list = el("div", { className: "remote-folder-list" });
      const cancel = el("button", { className: "wide-action", text: "Cancelar" });
      const open = el("button", { className: "primary", text: "Abrir" });
      const actions = el("div", { className: "remote-folder-actions", children: [cancel, open] });
      let settled = false, generation = 0, selectedIndex = 0, entries: Array<{ path: string; name: string }> = [];
      const finish = (value?: string) => { if (settled) return; settled = true; overlay.remove(); resolve(value); };
      const select = (entry: { path: string }) => { input.value = `${entry.path.replace(/\/$/, "")}/`; selectedIndex = 0; void refresh(); };
      const render = () => { list.replaceChildren(); entries.forEach((entry, index) => { const row = el("button", { className: `remote-folder-row ${index === selectedIndex ? "active" : ""}`, children: [fileIcon(entry.name, true), el("span", { text: entry.name }), el("small", { text: entry.path })] }); row.addEventListener("mouseenter", () => { selectedIndex = index; render(); }); row.addEventListener("click", () => select(entry)); row.addEventListener("dblclick", () => finish(entry.path)); list.append(row); }); };
      const refresh = async () => { const currentGeneration = ++generation; const value = input.value.trim() || "/"; const slash = value.lastIndexOf("/"); const directory = value.endsWith("/") ? value : slash <= 0 ? "/" : value.slice(0, slash) || "/"; const prefix = value.endsWith("/") ? "" : value.slice(slash + 1).toLowerCase(); status.textContent = `Lendo ${directory}…`; try { const raw = await api.remote.sendRpc<Array<{ path: string; name: string; type: string }>>(sessionId, "fs.readDir", { path: directory }); if (settled || currentGeneration !== generation) return; entries = raw.filter(entry => entry.type === "directory" && entry.name.toLowerCase().startsWith(prefix)).map(entry => ({ path: entry.path, name: entry.name })).sort((a, b) => a.name.localeCompare(b.name)); selectedIndex = Math.min(selectedIndex, Math.max(0, entries.length - 1)); status.textContent = entries.length ? `${entries.length} pasta(s) em ${directory}` : `Nenhuma pasta corresponde a “${prefix}” em ${directory}`; render(); } catch (error) { if (settled || currentGeneration !== generation) return; entries = []; render(); status.textContent = error instanceof Error ? error.message : "Não foi possível acessar esse caminho."; } };
      let timer: number | undefined;
      input.addEventListener("input", () => { if (timer !== undefined) window.clearTimeout(timer); timer = window.setTimeout(() => void refresh(), 160); });
      input.addEventListener("keydown", event => { if (event.key === "ArrowDown" || event.key === "ArrowUp") { event.preventDefault(); if (entries.length) { selectedIndex = (selectedIndex + (event.key === "ArrowDown" ? 1 : -1) + entries.length) % entries.length; render(); list.querySelector<HTMLElement>(".active")?.scrollIntoView({ block: "nearest" }); } } else if (event.key === "Tab" && entries[selectedIndex]) { event.preventDefault(); select(entries[selectedIndex]); } else if (event.key === "Enter") { event.preventDefault(); if (entries[selectedIndex] && !input.value.endsWith("/")) select(entries[selectedIndex]); else finish(input.value.replace(/\/$/, "") || "/"); } });
      cancel.addEventListener("click", () => finish()); open.addEventListener("click", () => finish(input.value.replace(/\/$/, "") || "/"));
      overlay.addEventListener("click", event => { if (event.target === overlay) finish(); }); overlay.addEventListener("keydown", event => { if (event.key === "Escape") finish(); });
      dialog.append(title, input, status, list, actions); overlay.append(dialog); document.body.append(overlay); input.focus(); input.select(); void refresh();
    });
  }

  private async testAndTrust(host: RemoteHostConfig, password?: string) {
    let result = await api.remote.test({ config: host, password, command: "pwd" });
    const marker = "Fingerprint ";
    const markerIndex = result.output.indexOf(marker);
    if (result.success || markerIndex < 0) return result;
    const fingerprint = result.output.slice(markerIndex + marker.length).trim().split(/\s/)[0];
    if (!fingerprint || !confirm(`Primeira conexão com ${host.host}.\n\nFingerprint SHA-256:\n${fingerprint}\n\nConfiar permanentemente nesta chave?`)) return result;
    host.hostKeyFingerprint = fingerprint;
    await api.remote.saveHosts(this.hosts);
    result = await api.remote.test({ config: host, password, command: "pwd" });
    return result;
  }

  private async list(remotePath: string): Promise<void> {
    if (!this.active || !this.sessionId) return;
    try {
      const raw = await api.remote.sendRpc<Array<{ path: string; name: string; type: string; size: number; mtimeMs: number }>>(this.sessionId, "fs.readDir", { path: remotePath });
      const entries: WorkspaceEntry[] = raw.map(entry => ({ path: entry.path, name: entry.name, directory: entry.type === "directory", size: entry.size, modifiedAt: entry.mtimeMs, hidden: entry.name.startsWith(".") }));
      this.currentPath = remotePath;
      this.renderEntries(entries);
    } catch (error) {
      reportError(error, this.updateStatus, "Falha ao listar arquivos remotos");
    }
  }

  private renderEntries(entries: WorkspaceEntry[]): void {
    this.tree.replaceChildren();
    const up = el("button", { className: "remote-entry", text: ".." });
    up.addEventListener("click", () => void this.list(parentRemote(this.currentPath)));
    this.tree.append(up);
    for (const entry of entries) {
      const row = el("button", { className: "remote-entry" });
      row.append(fileIcon(entry.name, entry.directory), el("span", { text: entry.name }));
      row.addEventListener("click", () => entry.directory ? void this.list(entry.path) : void this.openFile(entry.path));
      row.addEventListener("contextmenu", event => {
        event.preventDefault();
        contextMenu([
          { label: "Abrir", action: () => entry.directory ? void this.list(entry.path) : void this.openFile(entry.path) },
          { label: "Novo arquivo", action: () => void this.touch(entry.directory ? entry.path : this.currentPath) },
          { label: "Nova pasta", action: () => void this.mkdir(entry.directory ? entry.path : this.currentPath) },
          { label: "Renomear", action: () => void this.rename(entry.path) },
          { label: "Excluir", danger: true, action: () => void this.delete(entry.path) }
        ], event.clientX, event.clientY);
      });
      this.tree.append(row);
    }
  }

  private async openFile(remotePath: string): Promise<void> {
    if (!this.active || !this.sessionId) return;
    const file = await api.remote.sendRpc<{ content: string; etag: string }>(this.sessionId, "fs.readFile", { path: remotePath });
    const sessionId = this.sessionId;
    this.openVirtualFile(basename(remotePath), `npsharp-remote://${encodeURIComponent(this.active.id!)}/${remotePath.replace(/^\/+/, "")}`, file.content, content =>
      api.remote.sendRpc<void>(sessionId, "fs.writeFile", { path: remotePath, content, etag: file.etag })
    );
  }

  private async touch(base: string): Promise<void> {
    if (!this.active || !this.sessionId) return;
    const name = await showInputDialog("Nome do arquivo remoto", "sem-título");
    if (!name) return;
    await api.remote.sendRpc(this.sessionId, "fs.createFile", { path: joinRemote(base, name) });
    await this.list(this.currentPath);
  }

  private async mkdir(base: string): Promise<void> {
    if (!this.active || !this.sessionId) return;
    const name = await showInputDialog("Nome da pasta remota", "nova-pasta");
    if (!name) return;
    await api.remote.sendRpc(this.sessionId, "fs.createDirectory", { path: joinRemote(base, name) });
    await this.list(this.currentPath);
  }

  private async rename(remotePath: string): Promise<void> {
    if (!this.active || !this.sessionId) return;
    const name = await showInputDialog("Novo nome remoto", basename(remotePath));
    if (!name) return;
    await api.remote.sendRpc(this.sessionId, "fs.rename", { oldPath: remotePath, newPath: joinRemote(parentRemote(remotePath), name) });
    await this.list(this.currentPath);
  }

  private async delete(remotePath: string): Promise<void> {
    if (!this.active || !this.sessionId || !confirm(`Delete ${remotePath}?`)) return;
    await api.remote.sendRpc(this.sessionId, "fs.delete", { path: remotePath, recursive: true });
    await this.list(this.currentPath);
  }

  private async executeCommand(): Promise<void> {
    if (!this.active || !this.sessionId || !this.command.value.trim()) return;
    const result = await api.remote.sendRpc<{ id: string; pid?: number }>(this.sessionId, "process.spawn", { command: "/bin/sh", args: ["-lc", this.command.value.trim()], cwd: this.currentPath });
    this.updateStatus(`Processo remoto iniciado (PID ${result.pid ?? result.id})`);
  }
}

function parentRemote(remotePath: string): string {
  const normalized = remotePath.replace(/\/+$/, "");
  const index = normalized.lastIndexOf("/");
  return index <= 0 ? "." : normalized.slice(0, index);
}

function joinRemote(parent: string, name: string): string {
  if (!parent || parent === ".") return name;
  return `${parent.replace(/\/+$/, "")}/${name}`;
}

function normalizeAuth(value: string): RemoteHostConfig["authMethod"] {
  const normalized = value.trim().toLowerCase();
  if (normalized === "key") return "key";
  if (normalized === "agent") return "agent";
  return "password";
}
