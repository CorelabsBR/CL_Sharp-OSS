import fs from "node:fs/promises";
import path from "node:path";
import { performance } from "node:perf_hooks";

export type StartupStage = "T0-process-started" | "T1-electron-ready" | "T2-window-created" | "T3-window-visible" | "T4-renderer-rendered" | "T5-editor-interactive" | "T6-secondary-scheduled";

export interface StartupProfileReport {
  readonly enabled: boolean;
  readonly startedAt: string;
  readonly stages: Array<{ stage: StartupStage; elapsedMs: number }>;
}

/**
 * Observabilidade de startup sem custo no uso normal. O relatório é emitido
 * somente com --profile-startup ou NPSHARP_PROFILE_STARTUP=1.
 */
export class StartupProfiler {
  private readonly enabled = process.argv.includes("--profile-startup") || process.env.NPSHARP_PROFILE_STARTUP === "1";
  private readonly startedAt = new Date().toISOString();
  private readonly started = performance.now();
  private readonly stages = new Map<StartupStage, number>();
  private written = false;

  constructor() {
    this.mark("T0-process-started");
  }

  mark(stage: StartupStage): void {
    if (!this.enabled || this.stages.has(stage)) return;
    this.stages.set(stage, performance.now() - this.started);
  }

  report(): StartupProfileReport {
    return {
      enabled: this.enabled,
      startedAt: this.startedAt,
      stages: [...this.stages.entries()].map(([stage, elapsedMs]) => ({ stage, elapsedMs: Math.round(elapsedMs * 10) / 10 }))
    };
  }

  async writeReport(defaultDirectory: string): Promise<void> {
    if (!this.enabled || this.written) return;
    this.written = true;
    const configured = process.argv.find(argument => argument.startsWith("--profile-startup-file="));
    const file = configured?.slice("--profile-startup-file=".length) || path.join(defaultDirectory, "startup-profile.json");
    const report = this.report();
    await fs.mkdir(path.dirname(file), { recursive: true });
    await fs.writeFile(file, `${JSON.stringify(report, null, 2)}\n`, "utf8");
    console.info(`[NPSharp startup] ${JSON.stringify(report)}`);
  }
}
