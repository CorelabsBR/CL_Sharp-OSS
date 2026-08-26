/*---------------------------------------------------------------------------------------------
- Copyright (c) CorelabsBR. All rights reserved.
- Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
import type { InstalledExtension, OpenVsxExtension } from "../../shared/types";
import { api, platform } from "../services/api";
import { buttonIcon, el, icon } from "../utils/dom";
import { reportError } from "../utils/errors";
import { fileUri } from "../utils/path";

export class ExtensionManagerPanel {
  readonly element = el("div", { className: "panel extensions-panel ui-panel" });
  private readonly search = el("input", {
    className: "panel-input extensions-search ui-field ui-search-field",
    attrs: { placeholder: "Pesquisar extensões" }
  });
  private readonly summary = el("div", { className: "panel-summary ui-panel-summary", text: "Extensões", attrs: { role: "status", "aria-live": "polite" } });
  private readonly list = el("div", { className: "extensions-list ui-list" });
  private installed: InstalledExtension[] = [];
  private marketplace: OpenVsxExtension[] = [];
  private marketplaceLoading = false;
  private marketplaceQuery = "";
  private searchTimer?: number;
  private remoteHost?: string;
  private activationStates = new Map<string, { state: "active" | "error"; message?: string }>();

  constructor(private readonly updateStatus: (text: string) => void, private readonly onChanged: () => void | Promise<void> = () => undefined) {
    const toolbar = el("div", { className: "panel-toolbar extensions-toolbar ui-toolbar" });
    toolbar.append(
      buttonIcon("cloud-download", "Instalar de VSIX", () => void this.installFromVsix()),
      buttonIcon("refresh", "Recarregar extensões", () => void this.reload())
    );
    this.search.addEventListener("input", () => {
      this.render();
      this.scheduleMarketplaceSearch();
    });
    this.element.append(toolbar, this.search, this.summary, this.list);
  }

  async refresh(): Promise<InstalledExtension[]> {
    if (!platform.canUseNodeBackend) {
      this.renderLimitedMode();
      return [];
    }
    try {
      const remote = await api.remote.getStatus();
      this.remoteHost = remote.status === "connected" ? remote.message.replace(/^Conectado a |\.$/g, "") : undefined;
      this.installed = await api.extensions.list();
      this.render();
      return this.installed;
    } catch (error) {
      this.summary.textContent = reportError(error, this.updateStatus, "Falha ao atualizar extensões");
      return [];
    }
  }

  focusSearch(): void {
    this.search.focus();
    this.search.select();
  }

  setActivationStates(states: ReadonlyMap<string, { state: "active" | "error"; message?: string }>): void {
    this.activationStates = new Map(states);
    this.render();
  }

  async installFromVsix(): Promise<void> {
    if (!platform.canUseNodeBackend) {
      this.updateStatus("A instalação de VSIX está disponível no desktop.");
      return;
    }
    try {
      const result = await api.dialog.openVsix();
      if (result.canceled || !result.paths[0]) return;
      const installed = await api.extensions.installVsix(result.paths[0]);
      this.updateStatus(`Extensão instalada: ${installed.displayName}`);
      await this.refresh();
      await this.onChanged();
    } catch (error) {
      reportError(error, this.updateStatus, "Falha na instalação do VSIX");
    }
  }

  async reload(id?: string): Promise<InstalledExtension[]> {
    if (!platform.canUseNodeBackend) {
      this.renderLimitedMode();
      return [];
    }
    try {
      this.installed = await api.extensions.reload(id);
      this.render();
      this.updateStatus(id ? `Extensão recarregada: ${id}` : "Extensões recarregadas");
      await this.onChanged();
      return this.installed;
    } catch (error) {
      reportError(error, this.updateStatus, "Falha ao recarregar extensões");
      return this.installed;
    }
  }

  private render(): void {
    const query = this.search.value.trim().toLowerCase();
    const visible = this.installed.filter(extension =>
      [
        extension.id,
        extension.displayName,
        extension.publisher,
        extension.version,
        extension.description,
        extension.categories.join(" ")
      ].join(" ").toLowerCase().includes(query)
    );

    this.summary.textContent = `${this.installed.length} extensão(ões) instalada(s) · ${this.remoteHost ? `Remoto: ${this.remoteHost}` : "Local"} · Open VSX`;
    this.list.replaceChildren();

    if (!visible.length) {
      this.list.append(el("div", {
        className: "muted-row",
        text: this.installed.length ? "Nenhuma extensão corresponde à pesquisa." : "Nenhuma extensão instalada."
      }));
    } else {
      for (const extension of visible) {
        this.list.append(this.extensionRow(extension));
      }
    }

    if (query) {
      const heading = el("div", {
        className: "extensions-marketplace-title ui-section-label ui-divider",
        text: this.marketplaceLoading ? "Pesquisando na Open VSX..." : "Open VSX Registry",
        attrs: { "aria-busy": String(this.marketplaceLoading) }
      });
      this.list.append(heading);
      if (!this.marketplaceLoading && this.marketplaceQuery === query && !this.marketplace.length) {
        this.list.append(el("div", { className: "muted-row", text: "Nenhuma extensão encontrada na Open VSX." }));
      }
      for (const extension of this.marketplace) this.list.append(this.marketplaceRow(extension));
    }
  }

  private renderLimitedMode(): void {
    this.summary.textContent = "Extensões indisponíveis";
    this.list.replaceChildren(el("div", {
      className: "muted-row",
      text: "A instalação local de VSIX requer o backend Electron de desktop."
    }));
  }

  private extensionRow(extension: InstalledExtension): HTMLElement {
    const row = el("section", { className: `extension-row ui-card ${extension.enabled ? "enabled" : "disabled"}` });
    const extensionIcon = this.createExtensionIcon(extension.displayName, extension.iconPath ? fileUri(extension.iconPath) : undefined);
    const title = el("div", { className: "extension-title" });
    title.append(
      el("strong", { text: extension.displayName }),
      el("span", { text: extension.id })
    );
    const meta = el("div", { className: "extension-meta" });
    const activation = this.activationStates.get(extension.id);
    meta.append(
      el("span", { text: extension.version }),
      el("span", { text: !extension.enabled ? "Desabilitada" : activation?.state === "active" ? "Ativa" : activation?.state === "error" ? "Erro" : "Habilitada" })
    );
    if (activation?.message) meta.append(el("span", { className: "extension-error", text: activation.message }));
    const description = el("p", { className: "extension-description", text: extension.description || "Sem descrição." });
    const categories = el("div", { className: "extension-categories" });
    for (const category of extension.categories.slice(0, 4)) {
      categories.append(el("span", { className: "ui-badge", text: category }));
    }

    const copy = el("div", { className: "extension-copy" });
    copy.append(title, meta, description, categories);

    const actions = el("div", { className: "extension-actions" });
    const toggle = el("button", { className: "mini-action ui-button ui-button-compact", text: extension.enabled ? "Desabilitar" : "Habilitar" });
    toggle.addEventListener("click", () => void this.toggle(extension));
    const reload = el("button", { className: "mini-action ui-button ui-button-compact", text: "Recarregar" });
    reload.addEventListener("click", () => void this.reload(extension.id));
    const uninstall = el("button", { className: "mini-action danger ui-button ui-button-compact ui-button-danger", text: "Desinstalar" });
    uninstall.addEventListener("click", () => void this.uninstall(extension));
    actions.append(toggle, reload, uninstall);

    row.append(extensionIcon, copy, actions);
    return row;
  }

  private marketplaceRow(extension: OpenVsxExtension): HTMLElement {
    const id = `${extension.namespace}.${extension.name}`.toLowerCase();
    const installed = this.installed.some(item => item.id.toLowerCase() === id);
    const row = el("section", { className: "extension-row marketplace-extension ui-card" });
    const extensionIcon = this.createExtensionIcon(extension.displayName, extension.iconUrl);
    const title = el("div", { className: "extension-title" });
    title.append(el("strong", { text: extension.displayName }), el("span", { text: id }));
    const meta = el("div", { className: "extension-meta", text: `${extension.version}${extension.downloads ? ` · ${extension.downloads.toLocaleString()} downloads` : ""}` });
    const copy = el("div", { className: "extension-copy" });
    copy.append(title, meta, el("p", { className: "extension-description", text: extension.description || "Sem descrição." }));
    const install = el("button", { className: "mini-action ui-button ui-button-compact", text: installed ? "Instalada" : "Instalar" });
    install.disabled = installed;
    install.addEventListener("click", () => void this.installFromOpenVsx(extension));
    row.append(extensionIcon, copy, el("div", { className: "extension-actions", children: [install] }));
    return row;
  }

  private createExtensionIcon(displayName: string, source?: string): HTMLElement {
    const fallback = () => el("span", {
      className: "extension-icon placeholder",
      title: displayName,
      children: [icon("extensions-large", displayName)]
    });
    if (!source) return fallback();

    const image = el("img", {
      className: "extension-icon",
      attrs: { src: source, alt: "", loading: "lazy", decoding: "async" }
    });
    image.addEventListener("error", () => image.replaceWith(fallback()), { once: true });
    return image;
  }

  private scheduleMarketplaceSearch(): void {
    if (this.searchTimer !== undefined) window.clearTimeout(this.searchTimer);
    const query = this.search.value.trim();
    if (!query || !platform.canUseNodeBackend) {
      this.marketplace = [];
      this.marketplaceQuery = query;
      this.marketplaceLoading = false;
      return;
    }
    this.marketplaceLoading = true;
    this.searchTimer = window.setTimeout(() => void this.searchOpenVsx(query), 280);
  }

  private async searchOpenVsx(query: string): Promise<void> {
    try {
      const results = await api.extensions.searchOpenVsx(query);
      if (this.search.value.trim() !== query) return;
      this.marketplace = results;
      this.marketplaceQuery = query;
    } catch (error) {
      if (this.search.value.trim() === query) {
        this.marketplace = [];
        this.marketplaceQuery = query;
        reportError(error, this.updateStatus, "Falha ao pesquisar na Open VSX");
      }
    } finally {
      if (this.search.value.trim() === query) {
        this.marketplaceLoading = false;
        this.render();
      }
    }
  }

  private async installFromOpenVsx(extension: OpenVsxExtension): Promise<void> {
    try {
      const installed = await api.extensions.installOpenVsx(extension);
      this.updateStatus(`Extensão instalada: ${installed.displayName}`);
      await this.refresh();
      await this.onChanged();
    } catch (error) {
      reportError(error, this.updateStatus, "Falha ao instalar a extensão da Open VSX");
    }
  }

  private async toggle(extension: InstalledExtension): Promise<void> {
    try {
      this.installed = extension.enabled
        ? await api.extensions.disable(extension.id)
        : await api.extensions.enable(extension.id);
      this.render();
      this.updateStatus(`${extension.enabled ? "Desabilitada" : "Habilitada"} ${extension.displayName}`);
      await this.onChanged();
    } catch (error) {
      reportError(error, this.updateStatus, "Falha ao alterar a extensão");
    }
  }

  private async uninstall(extension: InstalledExtension): Promise<void> {
    try {
      this.installed = await api.extensions.uninstall(extension.id);
      this.render();
      this.updateStatus(`Extensão desinstalada: ${extension.displayName}`);
      await this.onChanged();
    } catch (error) {
      reportError(error, this.updateStatus, "Falha ao desinstalar a extensão");
    }
  }
}
