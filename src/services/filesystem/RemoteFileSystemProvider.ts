/*---------------------------------------------------------------------------------------------
- Copyright (c) CorelabsBR. All rights reserved.
- Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
import type { Disposable, FileStat, FileSystemEntry, FileSystemProvider, WatchOptions, DeleteOptions } from "./FileSystemProvider";

export interface RemoteFileSystemRpc {
  request<T>(method: string, params: unknown): Promise<T>;
  watch?(uri: string, listener: () => void): Disposable;
}

export class RemoteFileSystemProvider implements FileSystemProvider {
  constructor(private readonly rpc: RemoteFileSystemRpc, private readonly hostId: string) {}

  readFile(uri: string): Promise<Uint8Array> {
    return this.rpc.request<{ content: string }>("fs.readFile", { path: this.path(uri), encoding: "base64" })
      .then(value => Uint8Array.from(Buffer.from(value.content, "base64")));
  }
  writeFile(uri: string, content: Uint8Array, etag?: string): Promise<void> {
    return this.rpc.request<void>("fs.writeFile", { path: this.path(uri), content: Buffer.from(content).toString("base64"), encoding: "base64", etag });
  }
  readDirectory(uri: string): Promise<FileSystemEntry[]> { return this.rpc.request("fs.readDir", { path: this.path(uri) }); }
  stat(uri: string): Promise<FileStat> { return this.rpc.request("fs.stat", { path: this.path(uri) }); }
  createDirectory(uri: string): Promise<void> { return this.rpc.request("fs.createDirectory", { path: this.path(uri) }); }
  delete(uri: string, options?: DeleteOptions): Promise<void> { return this.rpc.request("fs.delete", { path: this.path(uri), ...options }); }
  rename(oldUri: string, newUri: string): Promise<void> { return this.rpc.request("fs.rename", { oldPath: this.path(oldUri), newPath: this.path(newUri) }); }
  watch(uri: string, _options?: WatchOptions): Disposable { return this.rpc.watch?.(uri, () => undefined) ?? { dispose() {} }; }

  private path(uri: string): string {
    const parsed = new URL(uri);
    if (parsed.protocol !== "sharp-remote:" || parsed.hostname !== this.hostId) throw new Error("REMOTE_INVALID_PATH");
    return decodeURIComponent(parsed.pathname);
  }
}
