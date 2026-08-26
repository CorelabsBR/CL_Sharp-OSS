/*---------------------------------------------------------------------------------------------
- Copyright (c) CorelabsBR. All rights reserved.
- Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
import type { LanguageRuntimeState, LanguageRuntimeStatus, LanguageRuntimeValidation } from "../../shared/types";
import { api } from "../services/api";
import { buttonIcon, el } from "../utils/dom";
import { reportError } from "../utils/errors";

export class LanguageRuntimesDialog {
  private overlay?: HTMLElement;
  private readonly list = el("div", { className: "runtime-config-list ui-list" });
  private readonly summary = el("div", { className: "panel-summary ui-panel-summary", text: "Carregando runtimes...", attrs: { role: "status", "aria-live": "polite" } });
  private states: LanguageRuntimeState[] = [];

  constructor(private readonly updateStatus: (text: string) => void) {}

  get visible(): boolean {
    return Boolean(this.overlay);
  }

  async show(): Promise<void> {
    if (this.overlay) {
      this.overlay.focus();
      return;
    }

    const overlay = el("div", { className: "runtime-config-overlay", attrs: { tabindex: "-1" } });
    const dialog = el("section", { className: "runtime-config-dialog", attrs: { "aria-label": "Configurar runtimes de linguagem" } });
    const header = el("header", { className: "runtime-config-header ui-panel-header" });
    const title = el("div", { className: "runtime-config-title" });
    title.append(
      el("h2", { text: "Configurar runtimes de linguagem" }),
      el("span", { text: "Os caminhos dos executáveis são armazenados em language-runtimes.json." })
    );
    header.append(title, buttonIcon("close", "Fechar", () => this.close()));
    const toolbar = el("div", { className: "runtime-config-toolbar ui-toolbar" });
    const refresh = el("button", { className: "wide-action ui-button", text: "Atualizar" });
    refresh.addEventListener("click", () => void this.refresh());
    toolbar.append(this.summary, refresh);
    dialog.append(header, toolbar, this.list);
    overlay.append(dialog);
    overlay.addEventListener("click", event => {
      if (event.target === overlay) this.close();
    });
    overlay.addEventListener("keydown", event => {
      if (event.key === "Escape") this.close();
    });
    document.body.append(overlay);
    this.overlay = overlay;
    overlay.focus();
    await this.refresh();
  }

  close(): void {
    this.overlay?.remove();
    this.overlay = undefined;
  }

  async refresh(): Promise<void> {
    try {
      this.states = await api.runtime.config();
      this.render();
    } catch (error) {
      this.summary.textContent = reportError(error, this.updateStatus, "Falha na configuração do runtime");
    }
  }

  private render(): void {
    const installed = this.states.filter(state => state.status === "installed").length;
    this.summary.textContent = `${installed}/${this.states.length} instalados`;
    this.list.replaceChildren();
    for (const state of this.states) {
      this.list.append(this.runtimeRow(state));
    }
  }

  private runtimeRow(state: LanguageRuntimeState): HTMLElement {
    const row = el("section", { className: `runtime-config-row ui-card ${state.status}` });
    const status = el("span", { className: `runtime-status ui-badge ${state.status}`, text: statusLabel(state.status) });
    const name = el("div", { className: "runtime-config-name" });
    name.append(el("strong", { text: state.language.displayName }), el("span", { text: state.message }));

    const input = el("input", {
      className: "panel-input runtime-path-input ui-field",
      attrs: {
        value: state.config.autoDetect ? state.detectedPath ?? state.config.path : state.config.path,
        placeholder: state.language.executableCandidates.join(", ")
      }
    });
    input.addEventListener("change", () => void this.updatePath(state, input.value));

    const auto = el("label", { className: "runtime-auto-row" });
    const autoInput = el("input", { attrs: { type: "checkbox" } });
    autoInput.checked = state.config.autoDetect;
    autoInput.addEventListener("change", () => void this.toggleAutoDetect(state, autoInput.checked));
    auto.append(autoInput, el("span", { text: "Detecção automática" }));

    const version = el("span", { className: "runtime-version", text: state.version ?? "--" });

    const actions = el("div", { className: "runtime-config-actions" });
    const browse = el("button", { className: "mini-action ui-button ui-button-compact", text: "Procurar..." });
    browse.addEventListener("click", () => void this.browse(state));
    const validate = el("button", { className: "mini-action ui-button ui-button-compact", text: "Validar" });
    validate.addEventListener("click", () => void this.validate(state, input.value, row));
    actions.append(browse, validate);

    row.append(status, name, input, auto, version, actions);
    return row;
  }

  private async updatePath(state: LanguageRuntimeState, executablePath: string): Promise<void> {
    try {
      this.states = await api.runtime.updateConfig(state.language.id, {
        path: executablePath.trim(),
        autoDetect: false
      });
      this.render();
      this.updateStatus(`Runtime de ${state.language.displayName} atualizado`);
    } catch (error) {
      reportError(error, this.updateStatus, "Falha ao atualizar o runtime");
    }
  }

  private async toggleAutoDetect(state: LanguageRuntimeState, enabled: boolean): Promise<void> {
    try {
      this.states = enabled
        ? await api.runtime.autoDetect(state.language.id)
        : await api.runtime.updateConfig(state.language.id, { ...state.config, autoDetect: false });
      this.render();
      this.updateStatus(enabled ? `Detecção automática atualizada para ${state.language.displayName}` : `Detecção automática desativada para ${state.language.displayName}`);
    } catch (error) {
      reportError(error, this.updateStatus, "Falha na detecção automática do runtime");
    }
  }

  private async browse(state: LanguageRuntimeState): Promise<void> {
    try {
      const result = await api.dialog.openFile();
      if (result.canceled || !result.paths[0]) return;
      this.states = await api.runtime.updateConfig(state.language.id, { path: result.paths[0], autoDetect: false });
      this.render();
      this.updateStatus(`Runtime de ${state.language.displayName} selecionado`);
    } catch (error) {
      reportError(error, this.updateStatus, "Falha ao procurar runtime");
    }
  }

  private async validate(state: LanguageRuntimeState, executablePath: string, row: HTMLElement): Promise<void> {
    try {
      const validation = await api.runtime.validate(state.language.id, executablePath.trim() || undefined);
      row.classList.remove("installed", "invalid", "missing");
      row.classList.add(validation.status);
      const status = row.querySelector<HTMLElement>(".runtime-status");
      if (status) {
        status.classList.remove("installed", "invalid", "missing");
        status.classList.add(validation.status);
        status.replaceChildren(document.createTextNode(statusLabel(validation.status)));
      }
      const version = row.querySelector(".runtime-version");
      if (version) version.textContent = validation.version ?? "--";
      const message = row.querySelector(".runtime-config-name span");
      if (message) message.textContent = validation.message;
      this.updateStatus(validation.message);
    } catch (error) {
      reportError(error, this.updateStatus, "Falha ao validar runtime");
    }
  }
}

function statusLabel(status: LanguageRuntimeStatus): string {
  const labels: Record<LanguageRuntimeStatus, string> = {
    installed: "✔ Instalado",
    invalid: "⚠ Inválido",
    missing: "❌ Ausente"
  };
  return labels[status];
}
