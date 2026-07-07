import fs from "node:fs/promises";
import path from "node:path";

const root = path.resolve(new URL("..", import.meta.url).pathname);
for (const target of ["dist", "dist-electron", "release"]) {
  await fs.rm(path.join(root, target), { recursive: true, force: true });
}

console.log("Cleaned dist, dist-electron and release.");
