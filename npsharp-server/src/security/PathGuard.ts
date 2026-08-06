/*---------------------------------------------------------------------------------------------
- Copyright (c) CorelabsBR. All rights reserved.
- Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
import fs from "node:fs/promises";
import { existsSync, realpathSync } from "node:fs";
import path from "node:path";

export class PathGuard {
  private roots: string[] = [];
  async setRoots(roots: string[]): Promise<void> {
    this.roots = await Promise.all(roots.map(root => fs.realpath(path.resolve(root))));
  }
  resolve(candidate: unknown): string {
    if (typeof candidate !== "string" || candidate.includes("\0")) throw coded("REMOTE_INVALID_PATH", "Caminho remoto inválido.");
    const resolved = path.resolve(candidate);
    let existing = resolved;
    while (!existsSync(existing) && path.dirname(existing) !== existing) existing = path.dirname(existing);
    const canonical = path.resolve(realpathSync(existing), path.relative(existing, resolved));
    if (this.roots.length && !this.roots.some(root => canonical === root || canonical.startsWith(root + path.sep))) {
      throw coded("REMOTE_INVALID_PATH", "Caminho fora das raízes autorizadas.");
    }
    return canonical;
  }
}

export function coded(code: string, message: string): Error & { code: string } {
  return Object.assign(new Error(message), { code });
}
