/*---------------------------------------------------------------------------------------------
- Copyright (c) CorelabsBR. All rights reserved.
- Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
export const appName = "Sharp-OSS";
export const appHost = "desktop";
export const language = "en";
export const machineId = "sharp-placeholder";
export const sessionId = "sharp-placeholder-session";
export const uriScheme = "sharp";

export async function openExternal(target: string): Promise<boolean> {
  console.info(`[Sharp-OSS extension] openExternal ${target}`);
  return false;
}
