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
const target = process.argv[2];
const npm = process.platform === "win32" ? "npm.cmd" : "npm";
const builder = process.platform === "win32"
  ? path.join(root, "node_modules", ".bin", "electron-builder.cmd")
  : path.join(root, "node_modules", ".bin", "electron-builder");

function run(command, args, extraEnv = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { cwd: root, stdio: "inherit", shell: false, env: { ...process.env, ...extraEnv } });
    child.on("exit", code => {
      if (code === 0) resolve();
      else reject(new Error(`${command} ${args.join(" ")} failed with code ${code}`));
    });
  });
}

await fs.rm(path.join(root, "dist"), { recursive: true, force: true });
await fs.rm(path.join(root, "dist-electron"), { recursive: true, force: true });
await run(npm, ["run", "typecheck"]);
await run(npm, ["run", "build:renderer"]);
await run(npm, ["run", "build:electron"]);

const args = [];
if (target === "linux") args.push("--linux");
if (target === "win") args.push("--win");
if (target === "portable-fast") args.push("--win", "dir", "--x64");
await run(builder, args, { USE_HARD_LINKS: "false" });
if (target === "portable-fast") await run(process.execPath, [path.join(root, "scripts", "package-portable-fast.mjs")]);
