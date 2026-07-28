/*---------------------------------------------------------------------------------------------
- Copyright (c) CorelabsBR. All rights reserved.
- Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
import { spawn } from "node:child_process";
import fs from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

const root = path.resolve(fileURLToPath(new URL("..", import.meta.url)));
const config = JSON.parse(await fs.readFile(path.join(root, "config.json"), "utf8"));
const npm = process.platform === "win32" ? "npm.cmd" : "npm";
const npx = process.platform === "win32" ? "npx.cmd" : "npx";

const dependencies = [
  `@capacitor/core@${config.npm.dependencies["@capacitor/core"]}`,
  `@capacitor/filesystem@${config.npm.dependencies["@capacitor/filesystem"]}`,
  `@capacitor/android@${config.npm.devDependencies["@capacitor/android"]}`,
  `@capacitor/cli@${config.npm.devDependencies["@capacitor/cli"]}`
];

await run(npm, ["install", ...dependencies]);
await run(npm, ["run", "config:sync"]);
await run(npx, ["cap", "init", config.application.displayName, config.application.applicationId, `--web-dir=${config.mobile.webDirectory}`]);
await run(npx, ["cap", "add", "android"]);

function run(command, args) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { cwd: root, stdio: "inherit", shell: false });
    child.once("error", reject);
    child.once("exit", code => code === 0 ? resolve() : reject(new Error(`${command} ${args.join(" ")} terminou com código ${code}`)));
  });
}
