/*---------------------------------------------------------------------------------------------
- Copyright (c) CorelabsBR. All rights reserved.
- Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
import fs from "node:fs";
import path from "node:path";

export interface PortableMode {
  readonly enabled: boolean;
  readonly directory?: string;
  readonly kind?: "single-executable" | "fast-folder";
}

/** Detecta somente formatos portáteis explicitamente marcados pelo empacote. */
export function detectPortableMode(): PortableMode {
  const portableDirectory = process.env.PORTABLE_EXECUTABLE_DIR;
  if (portableDirectory) {
    return { enabled: true, directory: path.resolve(portableDirectory), kind: "single-executable" };
  }
  const directory = path.dirname(process.execPath);
  if (fs.existsSync(path.join(directory, "portable.json"))) {
    return { enabled: true, directory, kind: "fast-folder" };
  }
  return { enabled: false };
}
