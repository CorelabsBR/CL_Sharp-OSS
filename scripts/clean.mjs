/*---------------------------------------------------------------------------------------------
- Copyright (c) CorelabsBR. All rights reserved.
- Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(fileURLToPath(new URL("..", import.meta.url)));
for (const target of ["dist", "dist-electron", "release"]) {
  await fs.rm(path.join(root, target), { recursive: true, force: true });
}

console.log("Cleaned dist, dist-electron and release.");
