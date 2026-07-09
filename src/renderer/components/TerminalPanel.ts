import type { TerminalDataEvent, TerminalExitEvent, TerminalShellOption } from "../../shared/types";
import { api, platform } from "../services/api";
import { buttonIcon, el } from "../utils/dom";
import { reportError } from "../utils/errors";
import { dirname, joinPath } from "../utils/path";

type TerminalMode = "terminal" | "debug" | "problems" | "output" | "ports" | "git";

interface TerminalSession {
  id: string;
  name: string;
  cwd: string;
  output: string;
  history: string[];
  historyIndex: number;
  shell: string;
  backend: "node-pty" | "child_process" | "local";
  running: boolean;
  localOnly: boolean;
}

const MAX_SCROLLBACK = 240000;

export class TerminalPanel {
  readonly element = el("section", { className: "terminal-panel" });
  private readonly header = el("div", { className: "terminal-header" });
  private readonly tabs = el("div", { className: "terminal-tabs" });
  private readonly output = el("pre", { className: "terminal-output" });
  private readonly input = el("input", { className: "terminal-input", attrs: { placeholder: "Command" } });
  private readonly debugOutput = el("pre", { className: "terminal-output debug-output" });
  private readonly debugInput = el("input", { className: "terminal-input debug-input", attrs: { placeholder: "Entrada do programa..." } });
  private readonly auxOutput = el("pre", { className: "terminal-output aux-output" });
  private readonly shellSelect = el("select", { className: "terminal-shell-select", title: "Shell" });
  private sessions: TerminalSession[] = [];
  private shellOptions: TerminalShellOption[] = [];
  private activeId?: string;
  private mode: TerminalMode = "terminal";
  private shell?: string;
  private terminalCounter = 0;
  private enabled = true;
  private creatingTerminal?: Promise<void>;

  constructor(
    private readonly cwdSupplier: () => string,
    private readonly updateStatus: (text: string) => void,
    private readonly closePanel: () => void
  ) {
    this.build();
  }

  hasTerminal(): boolean {
    return this.sessions.length > 0 || Boolean(this.creatingTerminal);
  }

  setEnabled(enabled: boolean): void {
    this.enabled = enabled;
  }

  setShell(shell?: string): void {
    this.shell = shell?.trim() || undefined;
    this.renderShellOptions();
  }

  newTerminal(): void {
    void this.startTerminalCreation();
  }

  async ensureTerminal(): Promise<void> {
    if (this.sessions.length > 0) return;
    if (this.creatingTerminal) {
      await this.creatingTerminal;
      return;
    }
    await this.startTerminalCreation();
  }

  splitTerminal(): void {
    this.newTerminal();
  }

  killCurrentTerminal(): void {
    void this.killCurrentProcess();
  }

  closeCurrentTerminal(): void {
    void this.closeActiveTerminal();
  }

  clearCurrentTerminal(): void {
    if (this.mode === "debug") {
      this.clearDebugConsole();
      return;
    }
    if (["problems", "output", "ports", "git"].includes(this.mode)) {
      this.auxOutput.textContent = "";
      this.render();
      return;
    }
    const session = this.activeSession();
    if (!session) return;
    session.output = session.localOnly ? this.prompt(session) : "";
    this.render();
  }

  focusCurrentTerminal(): void {
    this.mode = "terminal";
    this.render();
    this.input.focus();
  }

  showDebugConsole(): void {
    this.mode = "debug";
    this.render();
  }

  showProblemsPanel(): void {
    this.mode = "problems";
    this.auxOutput.textContent = "Use o painel Problems na Activity Bar para ver diagnosticos e navegar ate os arquivos.";
    this.render();
  }

  showOutputPanel(): void {
    this.mode = "output";
    if (!this.auxOutput.textContent.trim()) {
      this.auxOutput.textContent = "[Output] Canal de saida ativo.";
    }
    this.render();
  }

  showPortsPanel(): void {
    this.mode = "ports";
    this.auxOutput.textContent = "[Ports] Nenhuma porta encaminhada.";
    this.render();
  }

  showGitPanel(): void {
    this.mode = "git";
    this.auxOutput.textContent = platform.canUseGit
      ? "[Git] Use o painel Source Control para branch, stage e commit."
      : "[Git] Git nativo ainda nao esta disponivel neste ambiente.";
    this.render();
  }

  showTerminal(): void {
    this.mode = "terminal";
    if (!this.hasTerminal()) this.newTerminal();
    this.render();
  }

  clearDebugConsole(): void {
    this.debugOutput.textContent = "";
  }

  appendDebugOutput(text: string): void {
    this.mode = "debug";
    this.debugOutput.textContent += `${text}\n`;
    this.render();
  }

  appendOutput(text: string): void {
    this.mode = "output";
    this.auxOutput.textContent += `${text}\n`;
    this.render();
  }

  appendTerminalOutput(text: string): void {
    void this.ensureTerminal().then(() => {
      this.mode = "terminal";
      const session = this.activeSession();
      if (!session) return;
      session.output = trimScrollback(`${session.output}${ensureTrailingNewline(text)}`);
      this.render();
    });
  }

  async runCommand(command: string): Promise<void> {
    await this.ensureTerminal();
    this.mode = "terminal";
    const session = this.activeSession();
    const normalized = command.trim();
    if (!session || !normalized) return;

    session.history.push(command);
    session.historyIndex = session.history.length;

    if (normalized === "clear" || normalized === "cls") {
      this.clearCurrentTerminal();
      return;
    }

    if (session.localOnly) {
      this.runLocalCommand(session, command);
      this.render();
      return;
    }

    if (!session.running) {
      session.output = trimScrollback(`${session.output}\n[terminal] Processo encerrado. Abra um novo terminal.\n`);
      this.updateStatus("Processo do terminal encerrado");
      this.render();
      return;
    }

    if (session.backend === "child_process") {
      session.output = trimScrollback(`${session.output}${this.prompt(session)}${command}\n`);
    }

    try {
      await api.terminal.write(session.id, `${command}\n`);
    } catch (error) {
      const message = reportError(error, this.updateStatus, "Terminal command failed");
      session.output = trimScrollback(`${session.output}${message}\n`);
    }
    this.render();
  }

  private build(): void {
    api.terminal.onData(event => this.handleTerminalData(event));
    api.terminal.onExit(event => this.handleTerminalExit(event));
    void this.loadShellOptions();

    const problemsTab = el("button", { className: "panel-tab", text: "PROBLEMS", attrs: { "data-mode": "problems" } });
    problemsTab.addEventListener("click", () => this.showProblemsPanel());
    const outputTab = el("button", { className: "panel-tab", text: "OUTPUT", attrs: { "data-mode": "output" } });
    outputTab.addEventListener("click", () => this.showOutputPanel());
    const debugTab = el("button", { className: "panel-tab", text: "DEBUG CONSOLE", attrs: { "data-mode": "debug" } });
    debugTab.addEventListener("click", () => this.showDebugConsole());
    const terminalTab = el("button", { className: "panel-tab active", text: "TERMINAL", attrs: { "data-mode": "terminal" } });
    terminalTab.addEventListener("click", () => this.showTerminal());
    const portsTab = el("button", { className: "panel-tab", text: "PORTS", attrs: { "data-mode": "ports" } });
    portsTab.addEventListener("click", () => this.showPortsPanel());
    const gitTab = el("button", { className: "panel-tab", text: "GIT", attrs: { "data-mode": "git" } });
    gitTab.addEventListener("click", () => this.showGitPanel());

    this.shellSelect.addEventListener("change", () => {
      this.shell = this.shellSelect.value;
      this.updateStatus(`Shell selecionado: ${this.shellLabel(this.shell)}`);
    });

    const actions = el("div", { className: "terminal-actions" });
    actions.append(
      buttonIcon("add", "New Terminal", () => this.newTerminal()),
      buttonIcon("split-horizontal", "Split Terminal", () => this.splitTerminal()),
      buttonIcon("clear-all", "Clear Terminal", () => this.clearCurrentTerminal()),
      buttonIcon("debug-stop", "Kill Process", () => this.killCurrentTerminal()),
      buttonIcon("trash", "Close Terminal", () => this.closeCurrentTerminal()),
      buttonIcon("close", "Close Terminal Panel", () => this.closePanel())
    );
    this.header.append(problemsTab, outputTab, debugTab, terminalTab, portsTab, gitTab, el("div", { className: "spacer" }), this.shellSelect, actions);
    this.input.addEventListener("keydown", event => {
      const session = this.activeSession();
      if (event.key === "Enter") {
        const command = this.input.value;
        this.input.value = "";
        void this.runCommand(command);
      } else if (event.key === "ArrowUp" && session) {
        event.preventDefault();
        session.historyIndex = Math.max(0, session.historyIndex - 1);
        this.input.value = session.history[session.historyIndex] ?? this.input.value;
      } else if (event.key === "ArrowDown" && session) {
        event.preventDefault();
        session.historyIndex = Math.min(session.history.length, session.historyIndex + 1);
        this.input.value = session.history[session.historyIndex] ?? "";
      }
    });
    this.debugInput.addEventListener("keydown", event => {
      if (event.key !== "Enter") return;
      const text = this.debugInput.value;
      if (!text) return;
      this.debugOutput.textContent += `> ${text}\n`;
      this.debugInput.value = "";
      this.render();
    });
    this.element.append(this.header, this.tabs, this.output, this.debugOutput, this.auxOutput, this.input, this.debugInput);
    this.newTerminal();
  }

  private async loadShellOptions(): Promise<void> {
    try {
      this.shellOptions = await api.terminal.shells();
    } catch {
      this.shellOptions = [];
    }
    this.renderShellOptions();
  }

  private startTerminalCreation(): Promise<void> {
    const promise = this.createTerminal();
    this.creatingTerminal = promise;
    void promise.finally(() => {
      if (this.creatingTerminal === promise) this.creatingTerminal = undefined;
    });
    return promise;
  }

  private async createTerminal(): Promise<void> {
    const cwd = this.cwdSupplier();
    const name = `Terminal ${++this.terminalCounter}`;
    const shell = this.selectedShell();

    if (!this.enabled || !platform.canUseTerminal) {
      const session = this.localSession(name, cwd, shell, this.enabled ? terminalUnavailableMessage() : "Terminal desativado nas configuracoes.");
      this.sessions.push(session);
      this.activeId = session.id;
      this.mode = "terminal";
      this.render();
      return;
    }

    try {
      const info = await api.terminal.create({ cwd, shell, name, cols: this.terminalCols(), rows: 30 });
      const output = info.backend === "child_process"
        ? `[terminal] Fallback child_process ativo: ${info.shell}\n`
        : "";
      this.sessions.push({
        id: info.id,
        name: info.name,
        cwd: info.cwd,
        output,
        history: [],
        historyIndex: -1,
        shell: info.shell,
        backend: info.backend,
        running: info.running,
        localOnly: false
      });
      this.activeId = info.id;
      this.mode = "terminal";
      this.updateStatus(`${info.name} aberto com ${this.shellLabel(info.shell)}`);
    } catch (error) {
      const message = reportError(error, this.updateStatus, "Terminal failed");
      this.sessions.push(this.localSession(name, cwd, shell, message));
      this.activeId = this.sessions.at(-1)?.id;
    }
    this.render();
  }

  private localSession(name: string, cwd: string, shell: string, message: string): TerminalSession {
    return {
      id: crypto.randomUUID(),
      name,
      cwd,
      output: `${message}\n${cwd}> `,
      history: [],
      historyIndex: -1,
      shell,
      backend: "local",
      running: false,
      localOnly: true
    };
  }

  private async killCurrentProcess(): Promise<void> {
    const session = this.activeSession();
    if (!session) return;
    if (session.localOnly || !session.running) {
      session.output = trimScrollback(`${session.output}\n[terminal] Nenhum processo ativo para encerrar.\n`);
      this.render();
      return;
    }
    try {
      await api.terminal.kill(session.id);
      session.output = trimScrollback(`${session.output}\n[terminal] Encerrando processo...\n`);
      this.updateStatus("Processo do terminal encerrado");
    } catch (error) {
      const message = reportError(error, this.updateStatus, "Kill terminal failed");
      session.output = trimScrollback(`${session.output}${message}\n`);
    }
    this.render();
  }

  private async closeActiveTerminal(): Promise<void> {
    const index = this.sessions.findIndex(item => item.id === this.activeId);
    if (index < 0) return;
    const [session] = this.sessions.splice(index, 1);
    if (!session.localOnly) {
      try {
        await api.terminal.close(session.id);
      } catch (error) {
        reportError(error, this.updateStatus, "Close terminal failed");
      }
    }
    this.activeId = this.sessions[Math.min(index, this.sessions.length - 1)]?.id;
    if (!this.activeId && this.sessions[0]) this.activeId = this.sessions[0].id;
    this.render();
  }

  private handleTerminalData(event: TerminalDataEvent): void {
    const session = this.sessions.find(item => item.id === event.id);
    if (!session) return;
    const normalized = normalizeTerminalData(event.data);
    if (normalized.clear) session.output = "";
    session.output = trimScrollback(`${session.output}${normalized.text}`);
    if (session.id === this.activeId && this.mode === "terminal") this.render();
  }

  private handleTerminalExit(event: TerminalExitEvent): void {
    const session = this.sessions.find(item => item.id === event.id);
    if (!session) return;
    session.running = false;
    const suffix = event.signal ? ` (${event.signal})` : "";
    session.output = trimScrollback(`${session.output}\n[terminal] Processo finalizado com codigo ${event.code ?? 0}${suffix}.\n`);
    if (session.id === this.activeId && this.mode === "terminal") this.render();
  }

  private runLocalCommand(session: TerminalSession, command: string): void {
    session.output = trimScrollback(`${session.output}${command}\n`);
    const cdTarget = parseCd(command);
    if (cdTarget !== undefined) {
      session.cwd = resolveCwd(session.cwd, cdTarget);
      session.output = trimScrollback(`${session.output}${this.prompt(session)}`);
      return;
    }
    session.output = trimScrollback(`${session.output}${terminalUnavailableMessage()}\n${this.prompt(session)}`);
    this.updateStatus("Terminal indisponivel neste ambiente");
  }

  private render(): void {
    this.tabs.replaceChildren();
    for (const session of this.sessions) {
      const button = el("button", {
        className: `terminal-tab ${session.id === this.activeId ? "active" : ""} ${session.running ? "running" : "stopped"}`.trim(),
        text: session.name,
        title: `${this.shellLabel(session.shell)} - ${session.running ? "running" : "stopped"}`
      });
      button.addEventListener("click", () => {
        this.activeId = session.id;
        this.mode = "terminal";
        this.render();
      });
      this.tabs.append(button);
    }
    const session = this.activeSession();
    this.output.textContent = session?.output ?? "";
    this.output.hidden = this.mode !== "terminal";
    this.tabs.hidden = this.mode !== "terminal";
    this.input.hidden = this.mode !== "terminal";
    this.input.disabled = this.mode !== "terminal" || !session;
    this.input.placeholder = session?.running || session?.localOnly ? "Command" : "Process stopped";
    this.shellSelect.hidden = this.mode !== "terminal";
    this.debugOutput.hidden = this.mode !== "debug";
    this.debugInput.hidden = this.mode !== "debug";
    this.auxOutput.hidden = !["problems", "output", "ports", "git"].includes(this.mode);
    this.output.scrollTop = this.output.scrollHeight;
    this.debugOutput.scrollTop = this.debugOutput.scrollHeight;
    this.auxOutput.scrollTop = this.auxOutput.scrollHeight;
    for (const button of Array.from(this.header.querySelectorAll<HTMLElement>(".panel-tab"))) {
      button.classList.toggle("active", button.dataset.mode === this.mode);
    }
  }

  private renderShellOptions(): void {
    const selected = this.selectedShell();
    this.shellSelect.replaceChildren();
    const available = this.shellOptions.filter(option => option.available);
    const options = available.length ? available : this.shellOptions;
    for (const option of options) {
      this.shellSelect.append(el("option", {
        text: option.available ? option.label : `${option.label} (missing)`,
        attrs: { value: option.path }
      }));
    }
    if (selected && !Array.from(this.shellSelect.options).some(option => option.value === selected)) {
      this.shellSelect.append(el("option", { text: this.shellLabel(selected), attrs: { value: selected } }));
    }
    this.shellSelect.value = selected;
  }

  private activeSession(): TerminalSession | undefined {
    return this.sessions.find(item => item.id === this.activeId);
  }

  private selectedShell(): string {
    const fromSelect = this.shellSelect.value?.trim();
    const configured = this.shell?.trim();
    const detectedDefault = this.shellOptions.find(option => option.default && option.available)?.path;
    const firstAvailable = this.shellOptions.find(option => option.available)?.path;
    return fromSelect || configured || detectedDefault || firstAvailable || "";
  }

  private shellLabel(shell: string): string {
    return this.shellOptions.find(option => option.path === shell)?.label || shell.split(/[\\/]/).pop() || shell || "default";
  }

  private terminalCols(): number {
    return Math.max(40, Math.floor((this.output.clientWidth || 960) / 8));
  }

  private prompt(session: TerminalSession): string {
    return `${session.cwd}> `;
  }
}

function parseCd(command: string): string | undefined {
  const match = command.trim().match(/^cd(?:\s+(.+))?$/);
  return match ? (match[1]?.replace(/^["']|["']$/g, "") ?? "") : undefined;
}

function resolveCwd(current: string, target: string): string {
  if (!target || target === "~") return current;
  if (target === "..") return dirname(current);
  if (target.startsWith("/") || /^[A-Za-z]:[\\/]/.test(target)) return target;
  return joinPath(current, target);
}

function terminalUnavailableMessage(): string {
  return platform.isMobile
    ? "Terminal real Node nao esta disponivel no mobile. Use este painel como Output/Command Log."
    : "Terminal real nao esta disponivel no modo web. Use este painel como Output/Command Log.";
}

function normalizeTerminalData(data: string): { text: string; clear: boolean } {
  const clear = /\x1bc|\x1B\[[0-?]*[ -/]*[HJ]/.test(data);
  const text = data
    .replace(/\x1B\][^\x07]*(?:\x07|\x1B\\)/g, "")
    .replace(/\x1B(?:[@-Z\\-_]|\[[0-?]*[ -/]*[@-~])/g, "")
    .replace(/\r\n/g, "\n")
    .replace(/\r/g, "");
  return { text, clear };
}

function trimScrollback(text: string): string {
  return text.length > MAX_SCROLLBACK ? text.slice(text.length - MAX_SCROLLBACK) : text;
}

function ensureTrailingNewline(text: string): string {
  return text.endsWith("\n") ? text : `${text}\n`;
}
