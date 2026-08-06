/*---------------------------------------------------------------------------------------------
- Copyright (c) CorelabsBR. All rights reserved.
- Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
export interface FileStat { type: "file" | "directory"; size: number; mtimeMs: number; etag?: string; }
export interface FileSystemEntry { name: string; type: "file" | "directory"; }
export interface DeleteOptions { recursive?: boolean; }
export interface WatchOptions { recursive?: boolean; }
export interface Disposable { dispose(): void; }

export interface FileSystemProvider {
  readFile(uri: string): Promise<Uint8Array>;
  writeFile(uri: string, content: Uint8Array, etag?: string): Promise<void>;
  readDirectory(uri: string): Promise<FileSystemEntry[]>;
  stat(uri: string): Promise<FileStat>;
  createDirectory(uri: string): Promise<void>;
  delete(uri: string, options?: DeleteOptions): Promise<void>;
  rename(oldUri: string, newUri: string): Promise<void>;
  watch(uri: string, options?: WatchOptions): Disposable;
}
