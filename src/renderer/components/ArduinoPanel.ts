/*---------------------------------------------------------------------------------------------
- Copyright (c) CorelabsBR. All rights reserved.
- Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
import type { ArduinoBoard, ArduinoBoardPort, ArduinoConfig } from "../../shared/types";
import { uiText } from "../../shared/i18n";
import { api, platform } from "../services/api";
import { buttonIcon, el } from "../utils/dom";
import { reportError } from "../utils/errors";
import { showInputDialog } from "../utils/inputDialog";
import { basename } from "../utils/path";

const BAUD_RATES = [300, 1200, 2400, 4800, 9600, 14400, 19200, 28800, 38400, 57600, 115200, 230400, 250000];

export class ArduinoPanel {
  readonly element = el("div", { className: "panel arduino-panel ui-panel" });
  private readonly summary = el("div", { className: "panel-summary ui-panel-summary", text: "Arduino", attrs: { role: "status", "aria-live": "polite" } });
  private readonly form = el("div", { className: "arduino-form" });
  private readonly cliPath = el("input", { className: "panel-input ui-field", attrs: { placeholder: "arduino-cli" } });
  private readonly sketchPath = el("input", { className: "panel-input ui-field", attrs: { placeholder: "Caminho do sketch" } });
  private readonly boardSelect = el("select", { className: "panel-input ui-field ui-select" });
  private readonly portSelect = el("select", { className: "panel-input ui-field ui-select" });
  private readonly baudSelect = el("select", { className: "panel-input ui-field ui-select" });
  private readonly output = el("pre", { className: "arduino-output" });
  private config: ArduinoConfig = { baudRate: 9600 };
  private boards: ArduinoBoard[] = [];
  private ports: ArduinoBoardPort[] = [];

  constructor(
    private readonly workspaceSupplier: () => string | undefined,
    private readonly openFile: (filePath: string) => Promise<void>,
    private readonly updateStatus: (text: string) => void
  ) {
    this.build();
  }

  async refresh(): Promise<void> {
    if (!platform.canUseNodeBackend) {
      await this.renderLimitedMode();
      return;
    }

    try {
      this.config = await api.arduino.loadConfig({ workspace: this.workspaceSupplier() });
      this.cliPath.value = this.config.cliPath ?? "";
      this.sketchPath.value = this.config.sketchPath ?? "";
      this.setBaudValue(this.config.baudRate);

      const info = await api.arduino.detect({ cliPath: this.config.cliPath });
      this.summary.textContent = info.available
        ? `Arduino CLI: ${info.path ?? "arduino-cli"}`
        : uiText(info.message);

      if (info.available) {
        const request = { workspace: this.workspaceSupplier(), cliPath: this.config.cliPath };
        const [ports, boards] = await Promise.all([
          api.arduino.listPorts(request),
          api.arduino.listBoards(request)
        ]);
        this.ports = ports;
        this.boards = boards;
      } else {
        this.ports = [];
        this.boards = [];
      }
      this.renderSelects();
    } catch (error) {
      this.summary.textContent = reportError(error, this.updateStatus, uiText("Falha ao atualizar Arduino"));
      this.renderSelects();
    }
  }

  private build(): void {
    const toolbar = el("div", { className: "panel-toolbar ui-toolbar" });
    const serialMonitorButton = buttonIcon("radio-tower", "Serial Monitor", () => void this.monitor());
    serialMonitorButton.classList.add("ui-tooltip-align-end");
    toolbar.append(
      buttonIcon("refresh", "Detect Arduino CLI", () => void this.refresh()),
      buttonIcon("add", "Criar sketch", () => void this.createSketch()),
      buttonIcon("build", "Compile", () => void this.compile()),
      buttonIcon("cloud-upload", "Upload", () => void this.upload()),
      serialMonitorButton
    );

    for (const baud of BAUD_RATES) {
      this.baudSelect.append(el("option", { text: String(baud), attrs: { value: String(baud) } }));
    }

    this.cliPath.addEventListener("change", () => void this.saveConfig({ cliPath: this.cliPath.value.trim() || undefined }).then(() => this.refresh()));
    this.sketchPath.addEventListener("change", () => void this.saveConfig({ sketchPath: this.sketchPath.value.trim() || undefined }));
    this.boardSelect.addEventListener("change", () => void this.saveConfig({ selectedBoardFqbn: this.boardSelect.value || undefined }));
    this.portSelect.addEventListener("change", () => void this.saveConfig({ selectedPort: this.portSelect.value || undefined }));
    this.baudSelect.addEventListener("change", () => void this.saveConfig({ baudRate: Number(this.baudSelect.value) || 9600 }));

    this.form.append(
      field(uiText("CLI"), this.cliPath),
      field(uiText("Sketch"), this.sketchPath),
      field(uiText("Placa"), this.boardSelect),
      field(uiText("Porta"), this.portSelect),
      field(uiText("Taxa de transmissão"), this.baudSelect)
    );
    this.element.append(toolbar, this.summary, this.form, this.output);
  }

  private async renderLimitedMode(): Promise<void> {
    this.config = await api.arduino.loadConfig({ workspace: this.workspaceSupplier() });
    this.summary.textContent = platform.isMobile
      ? uiText("Arduino CLI indisponível no mobile")
      : uiText("Arduino CLI indisponível no modo web");
    this.cliPath.value = this.config.cliPath ?? "";
    this.sketchPath.value = this.config.sketchPath ?? "";
    this.setBaudValue(this.config.baudRate);
    this.ports = [];
    this.boards = [];
    this.renderSelects();
    this.output.textContent = uiText("Modo limitado: crie e edite sketches, mas compilação, envio e monitor serial dependem do desktop com Arduino CLI.");
  }

  private renderSelects(): void {
    this.boardSelect.replaceChildren(el("option", { text: "Selecione a placa", attrs: { value: "" } }));
    if (this.config.selectedBoardFqbn && !this.boards.some(board => board.fqbn === this.config.selectedBoardFqbn)) {
      this.boardSelect.append(el("option", {
        text: uiText("Placa salva ({board})").replace("{board}", this.config.selectedBoardFqbn),
        attrs: { value: this.config.selectedBoardFqbn }
      }));
    }
    for (const board of this.boards) {
      this.boardSelect.append(el("option", {
        text: `${board.name} (${board.fqbn})`,
        attrs: { value: board.fqbn }
      }));
    }
    this.boardSelect.value = this.config.selectedBoardFqbn ?? "";

    this.portSelect.replaceChildren(el("option", { text: "Selecione a porta", attrs: { value: "" } }));
    if (this.config.selectedPort && !this.ports.some(port => port.port === this.config.selectedPort)) {
      this.portSelect.append(el("option", {
        text: uiText("Porta salva ({port})").replace("{port}", this.config.selectedPort),
        attrs: { value: this.config.selectedPort }
      }));
    }
    for (const port of this.ports) {
      const label = [port.port, port.boardName, port.fqbn].filter(Boolean).join(" - ");
      this.portSelect.append(el("option", { text: label || port.raw, attrs: { value: port.port } }));
    }
    this.portSelect.value = this.config.selectedPort ?? "";
  }

  private async createSketch(): Promise<void> {
    const name = await showInputDialog(uiText("Nome do sketch"), "Blink");
    if (!name?.trim()) return;
    try {
      const result = await api.arduino.createSketch({ workspace: this.workspaceSupplier(), name });
      this.config = result.config;
      this.sketchPath.value = result.sketchPath;
      await this.openFile(result.filePath);
      this.appendOutput(uiText("Sketch criado: {file}").replace("{file}", basename(result.filePath)));
      this.updateStatus(uiText("Sketch Arduino criado: {path}").replace("{path}", result.sketchPath));
    } catch (error) {
      this.appendOutput(reportError(error, this.updateStatus, uiText("Falha ao criar sketch Arduino")));
    }
  }

  private async compile(): Promise<void> {
    const request = this.operationRequest();
    if (!request) return;
    this.appendOutput(`arduino-cli compile --fqbn ${request.fqbn} ${request.sketchPath}`);
    try {
      const result = await api.arduino.compile(request);
      this.appendOutput(uiText(result.output));
      this.updateStatus(result.success ? uiText("Compilação do Arduino concluída") : uiText("Falha na compilação do Arduino"));
    } catch (error) {
      this.appendOutput(reportError(error, this.updateStatus, uiText("Falha na compilação do Arduino")));
    }
  }

  private async upload(): Promise<void> {
    const request = this.operationRequest();
    const port = this.portSelect.value || this.config.selectedPort;
    if (!request || !port) {
      this.updateStatus(uiText("Selecione uma porta Arduino."));
      return;
    }
    this.appendOutput(`arduino-cli upload -p ${port} --fqbn ${request.fqbn} ${request.sketchPath}`);
    try {
      const result = await api.arduino.upload({ ...request, port });
      this.appendOutput(uiText(result.output));
      this.updateStatus(result.success ? uiText("Upload do Arduino concluído") : uiText("Falha no upload do Arduino"));
    } catch (error) {
      this.appendOutput(reportError(error, this.updateStatus, uiText("Falha no upload do Arduino")));
    }
  }

  private async monitor(): Promise<void> {
    const port = this.portSelect.value || this.config.selectedPort;
    if (!port) {
      this.updateStatus(uiText("Selecione uma porta Arduino."));
      return;
    }
    const baudRate = Number(this.baudSelect.value) || this.config.baudRate || 9600;
    this.appendOutput(`arduino-cli monitor -p ${port} -c baudrate=${baudRate}`);
    try {
      const result = await api.arduino.monitor({
        workspace: this.workspaceSupplier(),
        cliPath: this.cliPath.value.trim() || this.config.cliPath,
        port,
        fqbn: this.boardSelect.value || this.config.selectedBoardFqbn,
        baudRate,
        durationMs: 10000
      });
      this.appendOutput(uiText(result.output));
      this.updateStatus(result.success ? uiText("Monitor serial concluído") : uiText("Monitor serial interrompido"));
    } catch (error) {
      this.appendOutput(reportError(error, this.updateStatus, uiText("Falha no monitor serial do Arduino")));
    }
  }

  private operationRequest(): { workspace?: string; cliPath?: string; sketchPath: string; fqbn: string } | undefined {
    const sketchPath = this.sketchPath.value.trim() || this.config.sketchPath;
    const fqbn = this.boardSelect.value || this.config.selectedBoardFqbn;
    if (!sketchPath) {
      this.updateStatus(uiText("Selecione ou crie um sketch Arduino."));
      return undefined;
    }
    if (!fqbn) {
      this.updateStatus(uiText("Selecione uma placa Arduino."));
      return undefined;
    }
    return {
      workspace: this.workspaceSupplier(),
      cliPath: this.cliPath.value.trim() || this.config.cliPath,
      sketchPath,
      fqbn
    };
  }

  private async saveConfig(config: Partial<ArduinoConfig>): Promise<void> {
    this.config = await api.arduino.saveConfig({ workspace: this.workspaceSupplier(), config });
  }

  private setBaudValue(value: number): void {
    const baud = String(value || 9600);
    if (!BAUD_RATES.includes(Number(baud))) {
      this.baudSelect.append(el("option", { text: baud, attrs: { value: baud } }));
    }
    this.baudSelect.value = baud;
  }

  private appendOutput(text: string): void {
    if (!text.trim()) return;
    this.output.textContent += `${text}\n`;
    this.output.scrollTop = this.output.scrollHeight;
  }
}

function field(label: string, control: HTMLElement): HTMLElement {
  const wrapper = el("label", { className: "arduino-field" });
  wrapper.append(el("span", { text: label }), control);
  return wrapper;
}
