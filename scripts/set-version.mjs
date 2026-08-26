/*---------------------------------------------------------------------------------------------
- Copyright (c) CorelabsBR. All rights reserved.
- Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
import { spawnSync } from "node:child_process";
import fs from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

const root = path.resolve(fileURLToPath(new URL("..", import.meta.url)));
const version = process.argv[2]?.trim();
const match = /^(\d+)\.(\d+)\.(\d+)(?:-[0-9A-Za-z.-]+)?$/.exec(version ?? "");

if (!match) {
  console.error("Versao invalida. Use SemVer, por exemplo: 1.0.1 ou 1.1.0-beta.1");
  process.exit(1);
}

const [, major, minor, patch] = match;
const versionCode = Number(major) * 10_000 + Number(minor) * 100 + Number(patch);
if (!Number.isSafeInteger(versionCode) || versionCode < 1 || Number(minor) > 99 || Number(patch) > 99) {
  console.error("Versao invalida para o Android: minor e patch devem estar entre 0 e 99.");
  process.exit(1);
}

const configPath = path.join(root, "config.json");
const config = JSON.parse(await fs.readFile(configPath, "utf8"));
config.application.version = version;
config.application.versionCode = versionCode;
await fs.writeFile(configPath, `${JSON.stringify(config, null, 2)}\n`, "utf8");

const npm = process.platform === "win32" ? "npm.cmd" : "npm";
const sync = spawnSync(npm, ["run", "config:sync"], { cwd: root, stdio: "inherit", shell: false });
if (sync.status !== 0) process.exit(sync.status ?? 1);

console.log(`Versao sincronizada: ${version} (Android versionCode ${versionCode})`);
