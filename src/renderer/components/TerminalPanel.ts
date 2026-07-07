import { api } from "../services/api";
import { buttonIcon, el } from "../utils/dom";
import { reportError } from "../utils/errors";
import { dirname, joinPath } from "../utils/path";

interface TerminalSession {
  id: string;
  name: string;
  cwd: string;
  output: string;
  history: string[];
  historyIndex: number;
}

export class TerminalPanel {
  readonly element = el("section", { className: "terminal-panel" });
  private readonly header = el("div", { className: "terminal-header" });
  private readonly tabs = el("div", { className: "terminal-tabs" });
  private readonly output = el("pre", { className: "terminal-output" });
  private readonly input = el("input", { className: "terminal-input", attrs: { placeholder: "Command" } });
  private readonly debugOutput = el("pre", { className: "terminal-output debug-output" });
  private readonly debugInput = el("input", { className: "terminal-input debug-input", attrs: { placeholder: "Entrada do programa..." } });
  private readonly auxOutput = el("pre", { className: "terminal-output aux-output" });
  private sessions: TerminalSession[] = [];
  private activeId?: string;
  private mode: "terminal" | "debug" | "problems" | "output" | "ports" | "git" = "terminal";
  private shell?: string;

  constructor(
    private readonly cwdSupplier: () => string,
    private readonly updateStatus: (text: string) => void,
    private readonly closePanel: () => void
  ) {
    this.build();
  }

  hasTerminal(): boolean {
    return this.sessions.length > 0;
  }

  setShell(shell?: string): void {
    this.shell = shell?.trim() || undefined;
  }

  newTerminal(): void {
    const session: TerminalSession = {
      id: crypto.randomUUID(),
      name: `Terminal ${this.sessions.length + 1}`,
      cwd: this.cwdSupplier(),
      output: "",
      history: [],
      historyIndex: -1
    };
    session.output = this.prompt(session);
    this.sessions.push(session);
    this.activeId = session.id;
    this.mode = "terminal";
    this.render();
  }

  splitTerminal(): void {
    this.newTerminal();
  }

  killCurrentTerminal(): void {
    const index = this.sessions.findIndex(item => item.id === this.activeId);
    if (index >= 0) {
      this.sessions.splice(index, 1);
      this.activeId = this.sessions[Math.max(0, index - 1)]?.id;
    }
    this.render();
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
    session.output = this.prompt(session);
    this.render();
  }

  focusCurrentTerminal(): void {
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
    this.auxOutput.textContent = "[Git] Use o painel Source Control para branch, stage e commit.";
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

  async runCommand(command: string): Promise<void> {
    if (!this.hasTerminal()) this.newTerminal();
    this.mode = "terminal";
    const session = this.activeSession();
    if (!session || !command.trim()) return;

    session.history.push(command);
    session.historyIndex = session.history.length;
    session.output += `${command}\n`;
    const cdTarget = parseCd(command);
    if (cdTarget !== undefined) {
      session.cwd = resolveCwd(session.cwd, cdTarget);
      session.output += this.prompt(session);
      this.render();
      return;
    }

    this.render();
    try {
      const result = await api.terminal.run({ cwd: session.cwd, command, shell: this.shell });
      session.cwd = result.cwd;
      session.output += result.output;
      if (result.output && !result.output.endsWith("\n")) session.output += "\n";
      session.output += this.prompt(session);
      this.updateStatus(`Command exited with ${result.code ?? 1}`);
    } catch (error) {
      const message = reportError(error, this.updateStatus, "Terminal command failed");
      session.output += `${message}\n${this.prompt(session)}`;
    }
    this.render();
  }

  private build(): void {
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
    const actions = el("div", { className: "terminal-actions" });
    actions.append(
      buttonIcon("add", "New Terminal", () => this.newTerminal()),
      buttonIcon("split-horizontal", "Split Terminal", () => this.splitTerminal()),
      buttonIcon("clear-all", "Clear", () => this.mode === "debug" ? this.clearDebugConsole() : this.clearCurrentTerminal()),
      buttonIcon("trash", "Kill Terminal", () => this.killCurrentTerminal()),
      buttonIcon("close", "Close Terminal Panel", () => this.closePanel())
    );
    this.header.append(problemsTab, outputTab, debugTab, terminalTab, portsTab, gitTab, el("div", { className: "spacer" }), actions);
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

  private render(): void {
    this.tabs.replaceChildren();
    for (const session of this.sessions) {
      const button = el("button", { className: `terminal-tab ${session.id === this.activeId ? "active" : ""}`, text: session.name });
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

  private activeSession(): TerminalSession | undefined {
    return this.sessions.find(item => item.id === this.activeId);
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
