import assert from "node:assert/strict";
import { EventEmitter } from "node:events";
import test from "node:test";
import { UpdateService, type UpdateProvider } from "./updateService";

class FakeUpdater extends EventEmitter implements UpdateProvider {
  autoDownload = true;
  autoInstallOnAppQuit = true;
  allowPrerelease = true;
  allowDowngrade = true;
  checkCalls = 0;
  downloadCalls = 0;
  installCalls = 0;
  checkError?: Error;
  private resolveDownload?: () => void;

  async checkForUpdates(): Promise<void> {
    this.checkCalls++;
    if (this.checkError) throw this.checkError;
  }

  downloadUpdate(): Promise<void> {
    this.downloadCalls++;
    return new Promise(resolve => { this.resolveDownload = resolve; });
  }

  completeDownload(version = "1.0.1"): void {
    this.emit("update-downloaded", { version });
    this.resolveDownload?.();
  }

  quitAndInstall(): void { this.installCalls++; }
}

function service(updater = new FakeUpdater(), options: Partial<ConstructorParameters<typeof UpdateService>[1]> = {}) {
  return {
    updater,
    service: new UpdateService(updater, {
      currentVersion: "1.0.0",
      isPackaged: true,
      platform: "win32",
      ...options
    })
  };
}

test("atualização nova muda para disponível e previne download duplicado", async () => {
  const { service: updaterService, updater } = service();
  updater.emit("update-available", { version: "1.0.1" });
  assert.deepEqual(updaterService.getStatus(), { state: "available", version: "1.0.1", message: "Atualização disponível: v1.0.1" });
  const first = updaterService.downloadUpdate();
  const second = updaterService.downloadUpdate();
  assert.equal(updater.downloadCalls, 1);
  updater.emit("download-progress", { percent: 47.2 });
  assert.equal(updaterService.getStatus().message, "Baixando atualização: 47%");
  updater.completeDownload();
  await Promise.all([first, second]);
  assert.equal(updaterService.getStatus().state, "downloaded");
  updaterService.installUpdate();
  assert.equal(updater.installCalls, 1);
});

test("ignora releases incompatíveis, antigas e prerelease", () => {
  const { service: updaterService, updater } = service();
  updater.emit("update-available", { version: "1.0.0" });
  assert.equal(updaterService.getStatus().state, "current");
  updater.emit("update-available", { version: "0.9.9" });
  assert.equal(updaterService.getStatus().state, "current");
  updater.emit("update-available", { version: "1.1.0-beta.1" });
  assert.equal(updaterService.getStatus().state, "current");
});

test("erros de rede, desenvolvimento e listeners removidos não travam a IDE", async () => {
  const network = service();
  network.updater.checkError = new Error("offline");
  await network.service.checkForUpdates();
  assert.equal(network.service.getStatus().state, "error");

  const development = service(new FakeUpdater(), { isPackaged: false });
  await development.service.checkForUpdates();
  assert.equal(development.service.getStatus().state, "unsupported");
  assert.equal(development.updater.checkCalls, 0);

  const portable = service(new FakeUpdater(), { isPortable: true });
  await portable.service.checkForUpdates();
  assert.equal(portable.service.getStatus().state, "unsupported");

  const listeners = service();
  let notifications = 0;
  const dispose = listeners.service.onStatus(() => notifications++);
  listeners.updater.emit("update-not-available");
  dispose();
  listeners.updater.emit("update-available", { version: "1.0.1" });
  assert.equal(notifications, 1);
});
