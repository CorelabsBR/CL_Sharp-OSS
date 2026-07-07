import os from "node:os";
import path from "node:path";

export function npsharpHome(): string {
  return path.join(os.homedir(), ".npsharp");
}

export function npsharpConfigDir(): string {
  return path.join(npsharpHome(), "config");
}

export function runtimeRegistryPath(): string {
  return path.join(npsharpConfigDir(), "runtime-registry.properties");
}

export function settingsPath(): string {
  return path.join(npsharpHome(), "settings.json");
}

export function recentFilesPath(): string {
  return path.join(npsharpHome(), "recent-files.json");
}

export function remoteHostsPath(): string {
  return path.join(npsharpHome(), "remote-hosts.json");
}

export function toolBinDir(): string {
  return path.join(npsharpHome(), "tools", "bin");
}
