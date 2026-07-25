import type { InstalledExtension } from "../../shared/types";
import { api, platform } from "../services/api";
import { buttonIcon, el, icon } from "../utils/dom";
import { reportError } from "../utils/errors";
import { fileUri } from "../utils/path";

export class ExtensionManagerPanel {
  readonly element = el("div", { className: "panel extensions-panel" });
  private readonly search = el("input", {
    className: "panel-input extensions-search",
    attrs: { placeholder: "Search Extensions" }
  });
  private readonly summary = el("div", { className: "panel-summary", text: "Extensions" });
  private readonly list = el("div", { className: "extensions-list" });
  private installed: InstalledExtension[] = [];

  constructor(private readonly updateStatus: (text: string) => void) {
    const toolbar = el("div", { className: "panel-toolbar extensions-toolbar" });
    toolbar.append(
      buttonIcon("cloud-download", "Install from VSIX", () => void this.installFromVsix()),
      buttonIcon("refresh", "Reload Extensions", () => void this.reload())
    );
    this.search.addEventListener("input", () => this.render());
    this.element.append(toolbar, this.search, this.summary, this.list);
  }

  async refresh(): Promise<InstalledExtension[]> {
    if (!platform.canUseNodeBackend) {
      this.renderLimitedMode();
      return [];
    }
    try {
      this.installed = await api.extensions.list();
      this.render();
      return this.installed;
    } catch (error) {
      this.summary.textContent = reportError(error, this.updateStatus, "Extensions refresh failed");
      return [];
    }
  }

  focusSearch(): void {
    this.search.focus();
    this.search.select();
  }

  async installFromVsix(): Promise<void> {
    if (!platform.canUseNodeBackend) {
      this.updateStatus("VSIX installation is available on desktop.");
      return;
    }
    try {
      const result = await api.dialog.openVsix();
      if (result.canceled || !result.paths[0]) return;
      const installed = await api.extensions.installVsix(result.paths[0]);
      this.updateStatus(`Installed ${installed.displayName}`);
      await this.refresh();
    } catch (error) {
      reportError(error, this.updateStatus, "VSIX installation failed");
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
      this.updateStatus(id ? `Reloaded ${id}` : "Extensions reloaded");
      return this.installed;
    } catch (error) {
      reportError(error, this.updateStatus, "Extension reload failed");
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

    this.summary.textContent = `${this.installed.length} installed extension(s)`;
    this.list.replaceChildren();

    if (!visible.length) {
      this.list.append(el("div", {
        className: "muted-row",
        text: this.installed.length ? "No extensions match your search." : "No extensions installed."
      }));
      return;
    }

    for (const extension of visible) {
      this.list.append(this.extensionRow(extension));
    }
  }

  private renderLimitedMode(): void {
    this.summary.textContent = "Extensions unavailable";
    this.list.replaceChildren(el("div", {
      className: "muted-row",
      text: "Local VSIX installation requires the desktop Electron backend."
    }));
  }

  private extensionRow(extension: InstalledExtension): HTMLElement {
    const row = el("section", { className: `extension-row ${extension.enabled ? "enabled" : "disabled"}` });
    const extensionIcon = extension.iconPath
      ? el("img", { className: "extension-icon", attrs: { src: fileUri(extension.iconPath), alt: "" } })
      : el("span", { className: "extension-icon placeholder", children: [icon("extensions-large", extension.displayName)] });
    const title = el("div", { className: "extension-title" });
    title.append(
      el("strong", { text: extension.displayName }),
      el("span", { text: extension.id })
    );
    const meta = el("div", { className: "extension-meta" });
    meta.append(
      el("span", { text: extension.version }),
      el("span", { text: extension.enabled ? "Enabled" : "Disabled" })
    );
    const description = el("p", { className: "extension-description", text: extension.description || "No description." });
    const categories = el("div", { className: "extension-categories" });
    for (const category of extension.categories.slice(0, 4)) {
      categories.append(el("span", { text: category }));
    }

    const copy = el("div", { className: "extension-copy" });
    copy.append(title, meta, description, categories);

    const actions = el("div", { className: "extension-actions" });
    const toggle = el("button", { className: "mini-action", text: extension.enabled ? "Disable" : "Enable" });
    toggle.addEventListener("click", () => void this.toggle(extension));
    const reload = el("button", { className: "mini-action", text: "Reload" });
    reload.addEventListener("click", () => void this.reload(extension.id));
    const uninstall = el("button", { className: "mini-action danger", text: "Uninstall" });
    uninstall.addEventListener("click", () => void this.uninstall(extension));
    actions.append(toggle, reload, uninstall);

    row.append(extensionIcon, copy, actions);
    return row;
  }

  private async toggle(extension: InstalledExtension): Promise<void> {
    try {
      this.installed = extension.enabled
        ? await api.extensions.disable(extension.id)
        : await api.extensions.enable(extension.id);
      this.render();
      this.updateStatus(`${extension.enabled ? "Disabled" : "Enabled"} ${extension.displayName}`);
    } catch (error) {
      reportError(error, this.updateStatus, "Extension toggle failed");
    }
  }

  private async uninstall(extension: InstalledExtension): Promise<void> {
    try {
      this.installed = await api.extensions.uninstall(extension.id);
      this.render();
      this.updateStatus(`Uninstalled ${extension.displayName}`);
    } catch (error) {
      reportError(error, this.updateStatus, "Extension uninstall failed");
    }
  }
}
