import type { InstalledRuntime } from "../../shared/types";
import { api } from "../services/api";
import { buttonIcon, el } from "../utils/dom";
import { reportError } from "../utils/errors";

export class RuntimePanel {
  readonly element = el("div", { className: "panel runtime-panel" });
  private readonly summary = el("div", { className: "panel-summary", text: "Runtimes" });
  private readonly list = el("div", { className: "runtime-list" });

  constructor(
    private readonly runCurrentFile: () => Promise<void>,
    private readonly updateStatus: (text: string) => void
  ) {
    const toolbar = el("div", { className: "panel-toolbar" });
    toolbar.append(
      buttonIcon("play", "Run Current File", () => void this.runCurrentFile()),
      buttonIcon("refresh", "Discover Runtimes", () => void this.refresh(true))
    );
    this.element.append(toolbar, this.summary, this.list);
  }

  async refresh(rescan = false): Promise<void> {
    try {
      const runtimes = rescan ? await api.runtime.discover() : await api.runtime.list();
      this.render(runtimes);
    } catch (error) {
      this.summary.textContent = reportError(error, this.updateStatus, "Runtime refresh failed");
    }
  }

  private render(runtimes: InstalledRuntime[]): void {
    this.summary.textContent = `${runtimes.length} runtime(s) registered`;
    this.list.replaceChildren();
    for (const runtime of runtimes) {
      const row = el("div", { className: "runtime-row" });
      row.append(
        el("strong", { text: runtime.language.displayName }),
        el("span", { text: runtime.version }),
        el("code", { text: runtime.executablePath })
      );
      const configure = el("button", { className: "mini-action", text: "Configure" });
      configure.addEventListener("click", () => void this.configure(runtime));
      row.append(configure);
      this.list.append(row);
    }
  }

  private async configure(runtime: InstalledRuntime): Promise<void> {
    const next = prompt(`Executable for ${runtime.language.displayName}`, runtime.executablePath);
    if (!next?.trim()) return;
    await api.runtime.configure(runtime.language.id, next.trim());
    await this.refresh(false);
  }
}
