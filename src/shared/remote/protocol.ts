/*---------------------------------------------------------------------------------------------
- Copyright (c) CorelabsBR. All rights reserved.
- Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
export interface RpcRequest<T = unknown> { id: string; method: string; params: T; }
export interface RpcSuccess<T = unknown> { id: string; success: true; result: T; }
export interface RpcFailure { id: string; success: false; error: { code: string; message: string; details?: unknown }; }
export interface RpcEvent<T = unknown> { event: string; payload: T; }
export type RpcResponse<T = unknown> = RpcSuccess<T> | RpcFailure;

export const REMOTE_RPC_METHODS = [
  "system.ping", "system.info", "system.capabilities", "system.shutdown",
  "fs.stat", "fs.readFile", "fs.writeFile", "fs.readDir", "fs.createFile",
  "fs.createDirectory", "fs.rename", "fs.move", "fs.copy", "fs.delete",
  "fs.exists", "fs.realpath", "fs.watch", "fs.unwatch", "fs.search", "fs.findFiles",
  "terminal.create", "terminal.write", "terminal.resize", "terminal.kill", "terminal.list",
  "process.spawn", "process.kill", "process.list",
  "workspace.open", "workspace.close", "workspace.getInfo"
] as const;

export type RemoteRpcMethod = typeof REMOTE_RPC_METHODS[number];
const methods = new Set<string>(REMOTE_RPC_METHODS);

export function parseRpcRequest(value: unknown): RpcRequest {
  if (!value || typeof value !== "object") throw new Error("REMOTE_INVALID_MESSAGE");
  const message = value as Record<string, unknown>;
  if (typeof message.id !== "string" || message.id.length < 1 || message.id.length > 128) throw new Error("REMOTE_INVALID_MESSAGE");
  if (typeof message.method !== "string" || !methods.has(message.method)) throw new Error("REMOTE_METHOD_NOT_FOUND");
  if (!("params" in message)) throw new Error("REMOTE_INVALID_MESSAGE");
  return { id: message.id, method: message.method, params: message.params };
}
