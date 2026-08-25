/*---------------------------------------------------------------------------------------------
- Copyright (c) CorelabsBR. All rights reserved.
- Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
import os from "node:os";
import path from "node:path";
import { BUILD_CONFIG } from "../../shared/buildConfig";

let dataRootOverride: string | undefined;

export function configureSharpDataRoot(root?: string): void {
  dataRootOverride = root ? path.resolve(root) : undefined;
}

export function sharpHome(): string {
  return dataRootOverride ?? path.join(os.homedir(), BUILD_CONFIG.dataDirectoryName);
}

export function sharpConfigDir(): string {
  return path.join(sharpHome(), "config");
}

export function runtimeRegistryPath(): string {
  return path.join(sharpConfigDir(), "runtime-registry.properties");
}

export function languageRuntimesPath(): string {
  return path.join(sharpHome(), "language-runtimes.json");
}

export function settingsPath(): string {
  return path.join(sharpHome(), "settings.json");
}

export function recentFilesPath(): string {
  return path.join(sharpHome(), "recent-files.json");
}

export function remoteHostsPath(): string {
  return path.join(sharpHome(), "remote-hosts.json");
}

export function toolBinDir(): string {
  return path.join(sharpHome(), "tools", "bin");
}
