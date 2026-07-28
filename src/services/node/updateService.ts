/*---------------------------------------------------------------------------------------------
- Copyright (c) CorelabsBR. All rights reserved.
- Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
import type { AppUpdateStatus } from "../../shared/types";
import { isNewerStableVersion, parseSemanticVersion } from "./updateSemver";

interface UpdateInfoLike { version: string; }
interface DownloadProgressLike { percent: number; }

export interface UpdateProvider {
  autoDownload: boolean;
  autoInstallOnAppQuit: boolean;
  allowPrerelease: boolean;
  allowDowngrade: boolean;
  on(event: "checking-for-update", listener: () => void): unknown;
  on(event: "update-available", listener: (info: UpdateInfoLike) => void): unknown;
  on(event: "update-not-available", listener: () => void): unknown;
  on(event: "download-progress", listener: (progress: DownloadProgressLike) => void): unknown;
  on(event: "update-downloaded", listener: (info: UpdateInfoLike) => void): unknown;
  on(event: "error", listener: (error: Error) => void): unknown;
  checkForUpdates(): Promise<unknown>;
  downloadUpdate(): Promise<unknown>;
  quitAndInstall(isSilent?: boolean, isForceRunAfter?: boolean): void;
}

export interface UpdateServiceOptions {
  currentVersion: string;
  isPackaged: boolean;
  platform: NodeJS.Platform;
  appImagePath?: string;
  isPortable?: boolean;
  logger?: Pick<Console, "info" | "warn">;
}

const INITIAL_STATUS: AppUpdateStatus = { state: "idle", message: "Atualizações ainda não foram verificadas." };

export class UpdateService {
  private status: AppUpdateStatus = INITIAL_STATUS;
  private readonly listeners = new Set<(status: AppUpdateStatus) => void>();
  private checkPromise?: Promise<AppUpdateStatus>;
  private downloadPromise?: Promise<AppUpdateStatus>;

  constructor(private readonly provider: UpdateProvider, private readonly options: UpdateServiceOptions) {
    provider.autoDownload = false;
    provider.autoInstallOnAppQuit = false;
    provider.allowPrerelease = false;
    provider.allowDowngrade = false;
    this.bindProviderEvents();
  }

  getStatus(): AppUpdateStatus { return { ...this.status }; }

  onStatus(listener: (status: AppUpdateStatus) => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  async checkForUpdates(): Promise<AppUpdateStatus> {
    if (!this.isSupported()) {
      return this.setStatus({ state: "unsupported", message: this.unsupportedMessage() });
    }
    if (this.checkPromise) return this.checkPromise;
    this.setStatus({ state: "checking", message: "Verificando atualizações do NPSharp…" });
    this.checkPromise = this.provider.checkForUpdates()
      .then(() => this.getStatus())
      .catch(error => this.setError(error, "Não foi possível verificar atualizações."))
      .finally(() => { this.checkPromise = undefined; });
    return this.checkPromise;
  }

  async downloadUpdate(): Promise<AppUpdateStatus> {
    if (this.status.state === "downloaded" || this.status.state !== "available") return this.getStatus();
    if (this.downloadPromise) return this.downloadPromise;
    this.setStatus({ state: "downloading", version: this.status.version, percent: 0, message: "Baixando atualização: 0%" });
    this.downloadPromise = this.provider.downloadUpdate()
      .then(() => this.getStatus())
      .catch(error => this.setError(error, "Não foi possível baixar a atualização."))
      .finally(() => { this.downloadPromise = undefined; });
    return this.downloadPromise;
  }

  installUpdate(): void {
    if (this.status.state !== "downloaded") return;
    this.setStatus({ state: "downloaded", version: this.status.version, message: "Reiniciando para instalar a atualização…" });
    this.provider.quitAndInstall(false, true);
  }

  private bindProviderEvents(): void {
    this.provider.on("checking-for-update", () => this.setStatus({ state: "checking", message: "Verificando atualizações do NPSharp…" }));
    this.provider.on("update-not-available", () => this.setStatus({ state: "current", message: "O NPSharp já está atualizado." }));
    this.provider.on("update-available", info => {
      if (!parseSemanticVersion(info.version) || !isNewerStableVersion(this.options.currentVersion, info.version)) {
        this.setStatus({ state: "current", message: "O NPSharp já está atualizado." });
        return;
      }
      this.setStatus({ state: "available", version: info.version, message: `Atualização disponível: v${info.version}` });
    });
    this.provider.on("download-progress", progress => {
      if (this.status.state !== "downloading") return;
      const percent = Math.min(100, Math.max(0, Math.round(progress.percent)));
      this.setStatus({ state: "downloading", version: this.status.version, percent, message: `Baixando atualização: ${percent}%` });
    });
    this.provider.on("update-downloaded", info => this.setStatus({ state: "downloaded", version: info.version, message: "Atualização pronta para instalar." }));
    this.provider.on("error", error => this.setError(error, "O atualizador encontrou um erro."));
  }

  private isSupported(): boolean {
    return this.options.isPackaged && !this.options.isPortable
      && (this.options.platform === "win32" || (this.options.platform === "linux" && Boolean(this.options.appImagePath)));
  }

  private unsupportedMessage(): string {
    if (!this.options.isPackaged) return "Atualizações automáticas são verificadas somente no aplicativo instalado.";
    if (this.options.isPortable) return "A edição portátil não é atualizada dentro do aplicativo; use o instalador NSIS.";
    if (this.options.platform === "linux") return "Atualização automática no Linux requer executar a edição AppImage.";
    return "Atualização automática disponível apenas para Windows instalado e Linux AppImage.";
  }

  private setError(error: unknown, fallback: string): AppUpdateStatus {
    const detail = error instanceof Error && error.message ? ` ${error.message}` : "";
    this.options.logger?.warn(`[NPSharp update] ${fallback}${detail}`);
    return this.setStatus({ state: "error", message: `${fallback}${detail}` });
  }

  private setStatus(status: AppUpdateStatus): AppUpdateStatus {
    this.status = status;
    this.options.logger?.info(`[NPSharp update] ${status.state}${status.version ? ` v${status.version}` : ""}`);
    for (const listener of this.listeners) listener({ ...status });
    return this.getStatus();
  }
}

export function createElectronUpdateService(options: UpdateServiceOptions): UpdateService {
  const { autoUpdater } = require("electron-updater") as { autoUpdater: UpdateProvider };
  return new UpdateService(autoUpdater, options);
}
