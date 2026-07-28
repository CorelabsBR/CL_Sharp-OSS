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
const packageJson = JSON.parse(await fs.readFile(path.join(root, "package.json"), "utf8"));
const productName = packageJson.build?.productName ?? packageJson.name;
const source = path.join(root, "release", "win-unpacked");
const output = path.join(root, "release", `${productName}-Portable-Fast-${packageJson.version}-x64.zip`);
const executable = process.platform === "win32"
  ? path.join(root, "node_modules", "7zip-bin", "win", "x64", "7za.exe")
  : path.join(root, "node_modules", "7zip-bin", "linux", "x64", "7za");

try {
  await fs.access(path.join(source, `${productName}.exe`));
} catch {
  throw new Error("O diretório release/win-unpacked não foi encontrado. Gere primeiro o alvo Windows dir do electron-builder.");
}

try {
  await fs.access(executable);
} catch {
  throw new Error("O compactador 7-Zip não foi encontrado. Execute npm ci para instalar a dependência 7zip-bin.");
}

if (process.platform !== "win32") await fs.chmod(executable, 0o755);

await fs.writeFile(path.join(source, "portable.json"), `${JSON.stringify({ format: `${productName} Portable Fast`, version: packageJson.version }, null, 2)}\n`, "utf8");
await fs.rm(output, { force: true });

await new Promise((resolve, reject) => {
  const child = spawn(executable, ["a", "-tzip", "-mx=1", output, "."], { cwd: source, stdio: "inherit", shell: false });
  child.once("error", reject);
  child.once("exit", code => code === 0 ? resolve() : reject(new Error(`7-Zip terminou com código ${code}`)));
});
