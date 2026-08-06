/*---------------------------------------------------------------------------------------------
- Copyright (c) CorelabsBR. All rights reserved.
- Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
import crypto from "node:crypto";
import fs from "node:fs/promises";
import { watch, type FSWatcher } from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawn, type ChildProcess } from "node:child_process";
import { WebSocketServer, type WebSocket } from "ws";
import { PathGuard, coded } from "./security/PathGuard.js";

const VERSION = "26.8.40";
const PROTOCOL_VERSION = 1;
const token = crypto.randomBytes(32).toString("base64url");
const tokenExpiresAt = Date.now() + 5 * 60_000;
const sessionId = process.env.NPSHARP_SESSION_ID || crypto.randomUUID();
const bootstrapFile = process.env.NPSHARP_BOOTSTRAP_FILE || "";
const logFile = process.env.NPSHARP_LOG_FILE || "";
if (!bootstrapFile) throw new Error("NPSHARP_BOOTSTRAP_FILE ausente.");
const guard = new PathGuard();
const roots = (process.env.NPSHARP_ALLOWED_ROOTS || process.cwd()).split(path.delimiter).filter(Boolean);
await guard.setRoots(roots);
const processes = new Map<string, ChildProcess>();
const workspaces = new Set<string>();
const watchers = new Map<string, FSWatcher>();
interface TerminalHandle { pid: number; write(data: string): void; resize(cols: number, rows: number): void; kill(): void; onData(listener: (data: string) => void): void; onExit(listener: (event: { exitCode: number; signal?: number | string }) => void): void; }
const terminals = new Map<string, TerminalHandle>();
const sockets = new Set<WebSocket>();
const pty = await import("node-pty").catch(() => undefined);
const scriptAvailable = await fs.access("/usr/bin/script").then(() => true, () => false);
const server = new WebSocketServer({ host: "127.0.0.1", port: 0, maxPayload: 16 * 1024 * 1024 });

server.on("connection", (socket, request) => {
  const supplied = new URL(request.url || "/", "http://localhost").searchParams.get("token") || "";
  const valid = Date.now() <= tokenExpiresAt && supplied.length === token.length && crypto.timingSafeEqual(Buffer.from(supplied), Buffer.from(token));
  if (!valid) { socket.close(1008, "Unauthorized"); return; }
  void fs.writeFile(bootstrapFile, JSON.stringify({ sessionId, pid: process.pid, host: "127.0.0.1", port: (server.address() as { port: number }).port, version: VERSION, protocolVersion: PROTOCOL_VERSION, capabilities: capabilityNames(), startedAt: new Date().toISOString(), logFile }), { encoding: "utf8", mode: 0o600 });
  sockets.add(socket);
  socket.on("close", () => sockets.delete(socket));
  socket.on("message", data => void dispatch(socket, data.toString()));
});

server.on("listening", () => {
  const address = server.address();
  if (!address || typeof address === "string") throw new Error("Endereço inválido.");
  const bootstrap = { sessionId, pid: process.pid, host: "127.0.0.1", port: address.port, token, version: VERSION, protocolVersion: PROTOCOL_VERSION, capabilities: capabilityNames(), startedAt: new Date().toISOString(), logFile };
  void fs.writeFile(bootstrapFile, JSON.stringify(bootstrap), { encoding: "utf8", mode: 0o600 }).then(() => process.stdout.write("NPSHARP_SERVER_READY\n"));
});

async function dispatch(socket: WebSocket, raw: string): Promise<void> {
  let id = "";
  try {
    const request = JSON.parse(raw) as { id?: unknown; method?: unknown; params?: unknown };
    if (typeof request.id !== "string" || typeof request.method !== "string" || raw.length > 16 * 1024 * 1024) throw coded("REMOTE_INVALID_MESSAGE", "Mensagem RPC inválida.");
    id = request.id;
    const result = await route(request.method, object(request.params));
    socket.send(JSON.stringify({ id, success: true, result }));
  } catch (error) {
    const value = error as Error & { code?: string };
    socket.send(JSON.stringify({ id, success: false, error: { code: value.code || "REMOTE_PROCESS_FAILED", message: value.message } }));
  }
}

async function route(method: string, p: Record<string, unknown>): Promise<unknown> {
  if (method === "system.ping") return { now: Date.now() };
  if (method === "system.info") return { platform: process.platform, arch: process.arch, hostname: os.hostname(), home: os.homedir(), shell: process.env.SHELL, node: process.version };
  if (method === "system.capabilities") return capabilities();
  if (method === "system.shutdown") { setTimeout(shutdown, 10); return true; }
  if (method === "workspace.open") { const root = guard.resolve(p.path); await fs.access(root); workspaces.add(root); return { root }; }
  if (method === "workspace.close") { workspaces.delete(guard.resolve(p.path)); return true; }
  if (method === "workspace.getInfo") return { roots: [...workspaces] };
  if (method === "fs.readFile") { const data = await fs.readFile(guard.resolve(p.path)); const stat = await fs.stat(guard.resolve(p.path)); return { content: data.toString(p.encoding === "base64" ? "base64" : "utf8"), etag: hash(data), mtimeMs: stat.mtimeMs, size: stat.size }; }
  if (method === "fs.writeFile") { const target = guard.resolve(p.path); const current = await fs.readFile(target).catch(() => undefined); if (p.etag && current && p.etag !== hash(current) && !p.overwrite) throw coded("REMOTE_FILE_MODIFIED", "Arquivo alterado externamente."); await fs.writeFile(target, Buffer.from(String(p.content || ""), p.encoding === "base64" ? "base64" : "utf8")); return true; }
  if (method === "fs.readDir") return Promise.all((await fs.readdir(guard.resolve(p.path), { withFileTypes: true })).map(async entry => { const target = path.join(guard.resolve(p.path), entry.name); const stat = await fs.stat(target); return { name: entry.name, path: target, type: entry.isDirectory() ? "directory" : "file", size: stat.size, mtimeMs: stat.mtimeMs }; }));
  if (method === "fs.stat") { const stat = await fs.stat(guard.resolve(p.path)); return { type: stat.isDirectory() ? "directory" : "file", size: stat.size, mtimeMs: stat.mtimeMs }; }
  if (method === "fs.exists") return fs.access(guard.resolve(p.path)).then(() => true, () => false);
  if (method === "fs.realpath") return fs.realpath(guard.resolve(p.path));
  if (method === "fs.createFile") { await fs.writeFile(guard.resolve(p.path), "", { flag: "wx" }); return true; }
  if (method === "fs.createDirectory") { await fs.mkdir(guard.resolve(p.path), { recursive: true }); return true; }
  if (method === "fs.delete") { await fs.rm(guard.resolve(p.path), { recursive: Boolean(p.recursive) }); return true; }
  if (method === "fs.rename" || method === "fs.move") { await fs.rename(guard.resolve(p.oldPath), guard.resolve(p.newPath)); return true; }
  if (method === "fs.copy") { await fs.cp(guard.resolve(p.oldPath), guard.resolve(p.newPath), { recursive: true }); return true; }
  if (method === "fs.watch") { const id = crypto.randomUUID(); const root = guard.resolve(p.path); let timer: NodeJS.Timeout | undefined; const pending = new Set<string>(); const watcher = watch(root, { recursive: Boolean(p.recursive) }, (_kind, filename) => { if (!filename) return; pending.add(path.join(root, filename.toString())); if (timer) clearTimeout(timer); timer = setTimeout(() => { for (const changedPath of pending) broadcast("fs.changed", { watcherId: id, path: changedPath }); pending.clear(); }, 100); }); watchers.set(id, watcher); return { id }; }
  if (method === "fs.unwatch") { watchers.get(String(p.id))?.close(); watchers.delete(String(p.id)); return true; }
  if (method === "process.spawn") return spawnProcess(p);
  if (method === "process.kill") { processes.get(String(p.id))?.kill(typeof p.signal === "string" ? p.signal as NodeJS.Signals : undefined); return true; }
  if (method === "process.list") return [...processes.keys()];
  if (method === "terminal.create") { if (!pty && !scriptAvailable) throw coded("REMOTE_SERVER_CAPABILITY_UNAVAILABLE", "Nenhum backend PTY disponível."); const id = crypto.randomUUID(); const shell = typeof p.shell === "string" ? p.shell : process.env.SHELL || "/bin/sh"; const cwd = p.cwd ? guard.resolve(p.cwd) : roots[0]; const terminal: TerminalHandle = pty ? pty.spawn(shell, [], { name: "xterm-256color", cols: numeric(p.cols, 80), rows: numeric(p.rows, 24), cwd, env: process.env as Record<string, string> }) : createScriptTerminal(shell, cwd); terminals.set(id, terminal); terminal.onData(data => broadcast("terminal.data", { id, data })); terminal.onExit(({ exitCode, signal }) => { terminals.delete(id); broadcast("terminal.exit", { id, exitCode, signal }); }); return { id, pid: terminal.pid, shell }; }
  if (method === "terminal.write") { terminals.get(String(p.id))?.write(String(p.data || "")); return true; }
  if (method === "terminal.resize") { terminals.get(String(p.id))?.resize(numeric(p.cols, 80), numeric(p.rows, 24)); return true; }
  if (method === "terminal.kill") { terminals.get(String(p.id))?.kill(); terminals.delete(String(p.id)); return true; }
  if (method === "terminal.list") return [...terminals.keys()];
  throw coded("REMOTE_METHOD_NOT_FOUND", `Método desconhecido: ${method}`);
}

function spawnProcess(p: Record<string, unknown>) { const command = String(p.command || ""); if (!command) throw coded("REMOTE_PROCESS_FAILED", "Comando ausente."); const id = crypto.randomUUID(); const child = spawn(command, Array.isArray(p.args) ? p.args.map(String) : [], { cwd: p.cwd ? guard.resolve(p.cwd) : roots[0], shell: false }); processes.set(id, child); child.stdout?.on("data", data => broadcast("process.stdout", { id, data: data.toString() })); child.stderr?.on("data", data => broadcast("process.stderr", { id, data: data.toString() })); child.on("exit", (code, signal) => { processes.delete(id); broadcast("process.exit", { id, code, signal }); }); return { id, pid: child.pid }; }
function broadcast(event: string, payload: unknown) { const data = JSON.stringify({ event, payload }); for (const socket of sockets) if (socket.readyState === socket.OPEN) socket.send(data); }
function object(value: unknown): Record<string, unknown> { return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {}; }
function hash(value: Buffer) { return crypto.createHash("sha256").update(value).digest("hex"); }
function capabilityNames() { return ["filesystem", "workspace", "process", "watch", ...(pty || scriptAvailable ? ["terminal", "watch"] : [])]; }
function capabilities() { return { filesystem: true, processes: true, workspace: true, terminal: Boolean(pty || scriptAvailable), watchers: true, version: VERSION, protocolVersion: PROTOCOL_VERSION, capabilities: capabilityNames() }; }
function numeric(value: unknown, fallback: number) { return typeof value === "number" && Number.isFinite(value) ? value : fallback; }
function createScriptTerminal(shell: string, cwd: string): TerminalHandle {
  const child = spawn("/usr/bin/script", ["-qfec", shell, "/dev/null"], { cwd, env: { ...process.env, TERM: "xterm-256color" }, stdio: "pipe" });
  return {
    pid: child.pid || 0,
    write: data => { child.stdin?.write(data); },
    resize: (cols, rows) => { child.stdin?.write(`stty cols ${Math.max(1, cols)} rows ${Math.max(1, rows)}\n`); },
    kill: () => { child.kill(); },
    onData: listener => { child.stdout?.on("data", data => listener(data.toString())); child.stderr?.on("data", data => listener(data.toString())); },
    onExit: listener => { child.on("close", (exitCode, signal) => listener({ exitCode: exitCode ?? 0, signal: signal ?? undefined })); }
  };
}
function shutdown() { void fs.rm(bootstrapFile, { force: true }); for (const watcher of watchers.values()) watcher.close(); for (const terminal of terminals.values()) terminal.kill(); for (const child of processes.values()) child.kill(); for (const socket of sockets) socket.close(1001); server.close(() => process.exit(0)); }
process.on("SIGTERM", shutdown); process.on("SIGINT", shutdown);
