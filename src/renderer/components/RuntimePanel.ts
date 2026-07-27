import type { InstalledRuntime } from "../../shared/types";
import { api, platform } from "../services/api";
import { buttonIcon, el } from "../utils/dom";
import { reportError } from "../utils/errors";

export class RuntimePanel {
  readonly element = el("div", { className: "panel runtime-panel" });
  private readonly summary = el("div", { className: "panel-summary", text: "Runtimes" });
  private readonly list = el("div", { className: "runtime-list" });

  constructor(
    private readonly runCurrentFile: () => Promise<void>,
    private readonly updateStatus: (text: string) => void,
    private readonly configureLanguageRuntimes: () => void
  ) {
    const toolbar = el("div", { className: "panel-toolbar" });
    toolbar.append(
      buttonIcon("play", "Executar arquivo atual", () => void this.runCurrentFile()),
      buttonIcon("refresh", "Detectar runtimes", () => void this.refresh(true))
    );
    this.element.append(toolbar, this.summary, this.list);
  }

  async refresh(rescan = false): Promise<void> {
    if (!platform.canUseNodeBackend) {
      this.renderLimitedMode();
      return;
    }
    try {
      const runtimes = rescan ? await api.runtime.discover() : await api.runtime.list();
      this.render(runtimes);
    } catch (error) {
      this.summary.textContent = reportError(error, this.updateStatus, "Falha ao atualizar runtimes");
    }
  }

  private render(runtimes: InstalledRuntime[]): void {
    this.summary.textContent = `${runtimes.length} runtime(s) registrado(s)`;
    this.list.replaceChildren();
    for (const runtime of runtimes) {
      const row = el("div", { className: "runtime-row" });
      row.append(
        el("strong", { text: runtime.language.displayName }),
        el("span", { text: runtime.version }),
        el("code", { text: runtime.executablePath })
      );
      const configure = el("button", { className: "mini-action", text: "Configurar" });
      configure.addEventListener("click", () => this.configureLanguageRuntimes());
      row.append(configure);
      this.list.append(row);
    }
  }

  private renderLimitedMode(): void {
    this.summary.textContent = platform.isMobile
      ? "Runtimes locais indisponiveis no mobile"
      : "Runtimes locais indisponiveis no modo web";
    this.list.replaceChildren(el("div", {
      className: "muted-row",
      text: "Arquivos HTML podem usar preview interno. Outras linguagens dependem de backend nativo futuro."
    }));
  }

}
