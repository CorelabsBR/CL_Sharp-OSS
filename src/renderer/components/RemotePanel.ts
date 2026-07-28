/*---------------------------------------------------------------------------------------------
- Copyright (c) CorelabsBR. All rights reserved.
- Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
import type { RemoteHostConfig, WorkspaceEntry } from "../../shared/types";
import { api } from "../services/api";
import { buttonIcon, contextMenu, el, fileIcon } from "../utils/dom";
import { reportError } from "../utils/errors";
import { basename } from "../utils/path";

export class RemotePanel {
  readonly element = el("div", { className: "panel remote-panel" });
  private readonly hostsBox = el("div", { className: "remote-hosts" });
  private readonly tree = el("div", { className: "remote-tree" });
  private readonly command = el("input", { className: "panel-input", attrs: { placeholder: "Comando remoto" } });
  private hosts: RemoteHostConfig[] = [];
  private active?: RemoteHostConfig;
  private password = "";
  private currentPath = ".";

  constructor(
    private readonly openVirtualFile: (title: string, uri: string, content: string, save: (content: string) => Promise<void>) => void,
    private readonly updateStatus: (text: string) => void
  ) {
    this.build();
  }

  async refresh(): Promise<void> {
    this.hosts = await api.remote.loadHosts();
    this.renderHosts();
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
    const config = this.promptHost();
    if (!config) return;
    this.hosts.push(config);
    await api.remote.saveHosts(this.hosts);
    this.renderHosts();
  }

  private async editHost(host: RemoteHostConfig): Promise<void> {
    const next = this.promptHost(host);
    if (!next) return;
    const index = this.hosts.indexOf(host);
    if (index >= 0) this.hosts[index] = next;
    if (this.active === host) this.active = next;
    await api.remote.saveHosts(this.hosts);
    this.renderHosts();
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
    const password = host.authMethod === "password" ? prompt(`Password for ${host.username}@${host.host}`) ?? "" : undefined;
    const result = await api.remote.test({ config: host, password, command: "pwd" });
    this.updateStatus(result.output || (result.success ? "Host remoto conectado" : "Falha no teste do host remoto"));
  }

  private promptHost(existing?: RemoteHostConfig): RemoteHostConfig | undefined {
    const host = prompt("Host", existing?.host ?? "");
    if (!host?.trim()) return undefined;
    const username = prompt("Username", existing?.username ?? "") ?? "";
    if (!username.trim()) return undefined;
    const portText = prompt("Port", String(existing?.port ?? 22)) ?? "22";
    const authInput = prompt("Auth method: password, key, agent", existing?.authMethod ?? "password") ?? "password";
    const authMethod = normalizeAuth(authInput);
    const privateKeyPath = authMethod === "key" ? prompt("Caminho da chave privada", existing?.privateKeyPath ?? "") ?? "" : "";
    const defaultPath = prompt("Caminho remoto padrão", existing?.defaultPath ?? ".") ?? ".";
    const name = prompt("Name", existing?.name ?? `${username}@${host}`) ?? `${username}@${host}`;
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
    this.active = host;
    if (host.authMethod === "password") {
      this.password = prompt(`Password for ${host.username}@${host.host}`) ?? "";
    }
    this.currentPath = host.defaultPath || ".";
    this.renderHosts();
    await this.list(this.currentPath);
  }

  private async list(remotePath: string): Promise<void> {
    if (!this.active) return;
    try {
      const entries = await api.remote.list({ config: this.active, password: this.password, path: remotePath });
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
    if (!this.active) return;
    const file = await api.remote.readFile({ config: this.active, password: this.password, path: remotePath });
    this.openVirtualFile(basename(remotePath), `remote:${this.active.host}:${remotePath}`, file.content, content =>
      api.remote.writeFile({ config: this.active!, password: this.password, path: remotePath, content })
    );
  }

  private async touch(base: string): Promise<void> {
    if (!this.active) return;
    const name = prompt("Nome do arquivo remoto", "sem-título");
    if (!name) return;
    await api.remote.touch({ config: this.active, password: this.password, path: joinRemote(base, name) });
    await this.list(this.currentPath);
  }

  private async mkdir(base: string): Promise<void> {
    if (!this.active) return;
    const name = prompt("Nome da pasta remota", "nova-pasta");
    if (!name) return;
    await api.remote.mkdir({ config: this.active, password: this.password, path: joinRemote(base, name) });
    await this.list(this.currentPath);
  }

  private async rename(remotePath: string): Promise<void> {
    if (!this.active) return;
    const name = prompt("Novo nome remoto", basename(remotePath));
    if (!name) return;
    await api.remote.rename({ config: this.active, password: this.password, path: remotePath, newPath: joinRemote(parentRemote(remotePath), name) });
    await this.list(this.currentPath);
  }

  private async delete(remotePath: string): Promise<void> {
    if (!this.active || !confirm(`Delete ${remotePath}?`)) return;
    await api.remote.delete({ config: this.active, password: this.password, path: remotePath });
    await this.list(this.currentPath);
  }

  private async executeCommand(): Promise<void> {
    if (!this.active || !this.command.value.trim()) return;
    const result = await api.remote.execute({ config: this.active, password: this.password, command: this.command.value.trim() });
    this.updateStatus(result.output || (result.success ? "Comando remoto concluído" : "Falha no comando remoto"));
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
