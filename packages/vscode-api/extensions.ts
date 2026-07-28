/*---------------------------------------------------------------------------------------------
- Copyright (c) CorelabsBR. All rights reserved.
- Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
export interface Extension<T = unknown> {
  readonly id: string;
  readonly extensionPath: string;
  readonly isActive: boolean;
  readonly exports: T | undefined;
  activate(): Promise<T | undefined>;
}

const registry = new Map<string, Extension>();

export function getExtension<T = unknown>(extensionId: string): Extension<T> | undefined {
  return registry.get(extensionId.toLowerCase()) as Extension<T> | undefined;
}

export const all: readonly Extension[] = [];

export function registerExtension(extension: Extension): void {
  registry.set(extension.id.toLowerCase(), extension);
}
