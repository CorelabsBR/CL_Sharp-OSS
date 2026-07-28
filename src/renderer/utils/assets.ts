/*---------------------------------------------------------------------------------------------
- Copyright (c) CorelabsBR. All rights reserved.
- Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
const BASE_URL = import.meta.env.BASE_URL || "./";

function normalizeResourcePath(path: string): string {
  return path.replace(/^\/+/, "");
}

function resourceBase(): string {
  return BASE_URL.endsWith("/") ? BASE_URL : `${BASE_URL}/`;
}

export function resourceUrl(path: string): string {
  return new URL(`${resourceBase()}${normalizeResourcePath(path)}`, document.baseURI).toString();
}

export function cssUrl(url: string): string {
  return `url("${url.replace(/["\\]/g, "\\$&")}")`;
}

export const DEFAULT_LOGO_URL = resourceUrl("logos/app.png");
