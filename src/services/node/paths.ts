/*---------------------------------------------------------------------------------------------
- Copyright (c) CorelabsBR. All rights reserved.
- Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
import os from "node:os";
import path from "node:path";
import { BUILD_CONFIG } from "../../shared/buildConfig";

let dataRootOverride: string | undefined;

export function configureNpsharpDataRoot(root?: string): void {
  dataRootOverride = root ? path.resolve(root) : undefined;
}

export function npsharpHome(): string {
  return dataRootOverride ?? path.join(os.homedir(), BUILD_CONFIG.dataDirectoryName);
}

export function npsharpConfigDir(): string {
  return path.join(npsharpHome(), "config");
}

export function runtimeRegistryPath(): string {
  return path.join(npsharpConfigDir(), "runtime-registry.properties");
}

export function languageRuntimesPath(): string {
  return path.join(npsharpHome(), "language-runtimes.json");
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
