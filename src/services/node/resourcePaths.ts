/*---------------------------------------------------------------------------------------------
- Copyright (c) CorelabsBR. All rights reserved.
- Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
import path from "node:path";

export function resourcesRoot(appPath: string, isPackaged: boolean): string {
  return isPackaged
    ? path.join(process.resourcesPath, "resources")
    : path.join(appPath, "resources");
}

export function resourcePath(appPath: string, isPackaged: boolean, ...segments: string[]): string {
  return path.join(resourcesRoot(appPath, isPackaged), ...segments);
}
