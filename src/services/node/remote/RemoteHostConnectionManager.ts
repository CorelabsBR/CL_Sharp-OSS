/*---------------------------------------------------------------------------------------------
- Copyright (c) CorelabsBR. All rights reserved.
- Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
import crypto from "node:crypto";
import fs from "node:fs/promises";
import net from "node:net";
import path from "node:path";
import { Client, type ConnectConfig, type SFTPWrapper } from "ssh2";
import WebSocket from "ws";
import { BUILD_CONFIG } from "../../../shared/buildConfig";
import type { RemoteConnectionState, RemoteLogEntry, RemotePlatformInfo, RemoteServerBootstrap, RemoteSessionSummary } from "../../../shared/remote/types";
import type { RpcEvent, RpcResponse } from "../../../shared/remote/protocol";
import type { RemoteHostConfig } from "../../../shared/types";
import { loadHosts, saveHosts } from "../remoteService";
import { RemoteCredentialStore } from "./RemoteCredentialStore";

const PROTOCOL_VERSION = 1;
const RPC_TIMEOUT = 15_000;

interface SessionResources {
  summary: RemoteSessionSummary; ssh: Client; tunnel: net.Server; rpc: RemoteRpcClient;
  bootstrapPath: string; workspace?: string;
}

export class RemoteHostConnectionManager {
  private state: RemoteConnectionState = { status: "disconnected", message: "Desconectado" };
  private readonly sessions = new Map<string, SessionResources>();
  private readonly logs: RemoteLogEntry[] = [];
  private readonly credentials = new RemoteCredentialStore();
  private abort?: AbortController;

  constructor(private readonly serverDist: string, private readonly emit: (channel: string, value: unknown) => void) {}

  getStatus(): RemoteConnectionState { return { ...this.state }; }
  listSessions(): RemoteSessionSummary[] { return [...this.sessions.values()].map(value => value.summary); }
  getLogs(): RemoteLogEntry[] { return [...this.logs]; }

  async connect(hostId: string, password?: string): Promise<RemoteSessionSummary> {
    if (this.abort) throw new Error("Já existe uma conexão em andamento.");
    this.abort = new AbortController();
    let ssh: Client | undefined; let tunnel: net.Server | undefined; let rpc: RemoteRpcClient | undefined;
    let bootstrap: RemoteServerBootstrap | undefined; let bootstrapPath = "";
    let installation: ReturnType<typeof remotePaths> | undefined;
    try {
      this.transition("resolving-host", "Localizando host...");
      const hosts = await loadHosts();
      const host = hosts.find(item => item.id === hostId);
      if (!host) throw coded("REMOTE_HOST_NOT_FOUND", "Host remoto não encontrado.");
      const secret = password ?? (host.id ? await this.credentials.get(host.id) : undefined);
      if (password && host.id) await this.credentials.set(host.id, password);
      this.transition("connecting", `Conectando a ${host.host}:${host.port}...`, host.id);
      ssh = await connectSsh(host, secret, this.abort.signal, status => this.transition(status, status === "verifying-host-key" ? "Verificando chave SSH..." : `Autenticando como ${host.username}...`, host.id));
      this.transition("detecting-platform", "Detectando plataforma remota...", host.id);
      const platform = await detectPlatform(ssh);
      if (platform.platform !== "linux" || !["x64", "arm64"].includes(platform.architecture)) throw coded("REMOTE_PLATFORM_UNSUPPORTED", `${platform.platform}-${platform.architecture} não é suportado.`);
      if (!platform.hasNode) throw coded("REMOTE_PLATFORM_UNSUPPORTED", "O artefato atual requer Node.js no host remoto.");
      this.log("info", "ssh", "Plataforma detectada", { platform: platform.platform, architecture: platform.architecture, nodeVersion: platform.nodeVersion });
      this.transition("checking-server", `Verificando NPSharp Server ${BUILD_CONFIG.version}...`, host.id);
      const install = remotePaths(platform.homeDirectory, BUILD_CONFIG.version, crypto.randomUUID()); installation = install;
      await ensureInstalled(ssh, this.serverDist, install, platform, this.abort.signal, phase => this.transition(phase, phase === "uploading-server" ? "Enviando NPSharp Server..." : "Instalando NPSharp Server...", host.id));
      this.transition("starting-server", "Iniciando NPSharp Server...", host.id);
      bootstrapPath = install.bootstrap;
      await launchServer(ssh, install, platform.homeDirectory);
      this.transition("reading-bootstrap", "Lendo bootstrap seguro...", host.id);
      bootstrap = await waitForBootstrap(ssh, bootstrapPath, this.abort.signal);
      validateBootstrap(bootstrap);
      this.transition("opening-tunnel", "Abrindo túnel SSH seguro...", host.id);
      const opened = await openTunnel(ssh, bootstrap.port);
      tunnel = opened.server;
      this.transition("connecting-websocket", "Conectando ao NPSharp Server...", host.id);
      rpc = await RemoteRpcClient.connect(`ws://127.0.0.1:${opened.port}/?token=${encodeURIComponent(bootstrap.token)}`);
      bootstrap.token = "";
      this.transition("authenticating-session", "Autenticando sessão remota...", host.id);
      const started = Date.now();
      await rpc.request("system.ping", {});
      this.transition("validating-server", "Validando servidor remoto...", host.id);
      const capabilities = await rpc.request<Record<string, unknown>>("system.capabilities", {});
      if (capabilities.version !== BUILD_CONFIG.version || capabilities.protocolVersion !== PROTOCOL_VERSION) throw coded("REMOTE_SERVER_VERSION_MISMATCH", "Versão ou protocolo do servidor incompatível.");
      for (const required of ["filesystem", "workspace", "process", "terminal", "watch"]) if (capabilities[required] !== true) throw coded("REMOTE_SERVER_CAPABILITY_MISSING", `Capability ausente: ${required}`);
      const summary: RemoteSessionSummary = { id: bootstrap.sessionId, hostId: host.id!, hostName: host.name || host.host, platform, bootstrap: withoutToken(bootstrap) };
      this.sessions.set(summary.id, { summary, ssh, tunnel, rpc, bootstrapPath });
      rpc.onEvent = event => this.emit("remote:event", { sessionId: summary.id, ...event });
      rpc.onClose = () => void this.reconnect(summary.id).catch(error => this.fail(error));
      this.state = { sessionId: summary.id, hostId: host.id, status: "connected", message: `Conectado a ${summary.hostName}.`, connectedAt: Date.now(), latencyMs: Date.now() - started, serverVersion: bootstrap.version, serverPid: bootstrap.pid };
      this.emit("remote:statusChanged", this.state); this.abort = undefined;
      return summary;
    } catch (error) {
      await rpc?.close(); await closeServer(tunnel);
      if (ssh && bootstrap?.pid) await exec(ssh, `kill ${Number(bootstrap.pid)}`).catch(() => undefined);
      if (ssh && installation) await exec(ssh, `rm -rf ${quote(installation.tmp)}`).catch(() => undefined);
      ssh?.end();
      this.abort = undefined; this.fail(error); throw error;
    }
  }

  async disconnect(sessionId: string): Promise<void> {
    const session = this.sessions.get(sessionId); if (!session) return;
    this.transition("disconnecting", "Desconectando...", session.summary.hostId);
    session.rpc.onClose = undefined;
    await session.rpc.request("system.shutdown", {}).catch(() => undefined);
    await session.rpc.close(); await closeServer(session.tunnel); session.ssh.end();
    this.sessions.delete(sessionId); this.state = { status: "disconnected", message: "Desconectado" }; this.emit("remote:statusChanged", this.state);
  }
  async uninstall(sessionId: string): Promise<void> {
    const session = required(this.sessions, sessionId); const home = session.summary.platform.homeDirectory;
    session.rpc.onClose = undefined; await session.rpc.request("system.shutdown", {}).catch(() => undefined); await session.rpc.close(); await closeServer(session.tunnel);
    await exec(session.ssh, `rm -rf ${quote(`${home}/.npsharp-server/bin/${BUILD_CONFIG.version}`)} ${quote(session.bootstrapPath)}`); session.ssh.end();
    this.sessions.delete(sessionId); this.state = { status: "disconnected", message: "NPSharp Server desinstalado." }; this.emit("remote:statusChanged", this.state);
  }

  async reconnect(sessionId: string): Promise<RemoteSessionSummary> {
    const old = this.sessions.get(sessionId); if (!old) throw coded("REMOTE_CONNECTION_LOST", "Sessão remota não encontrada.");
    const { hostId, workspace } = old.summary; await this.disconnect(sessionId); this.transition("reconnecting", "Reconectando...", hostId);
    let last: unknown; for (const delay of [1000, 2000, 5000, 10000, 30000]) { try { const session = await this.connect(hostId); if (workspace) await this.openFolder(session.id, workspace); return session; } catch (error) { last = error; await new Promise(resolve => setTimeout(resolve, delay)); } }
    throw last;
  }

  async openFolder(sessionId: string, remotePath: string): Promise<string> {
    const session = required(this.sessions, sessionId); const result = await session.rpc.request<{ root: string }>("workspace.open", { path: remotePath });
    session.workspace = result.root; session.summary.workspace = result.root; this.state.remotePath = result.root; this.emit("remote:statusChanged", this.state);
    return `npsharp-remote://${encodeURIComponent(session.summary.hostId)}${result.root}`;
  }
  request<T>(sessionId: string, method: string, params: unknown): Promise<T> { return required(this.sessions, sessionId).rpc.request(method, params); }
  resolveUri(uri: string): { sessionId: string; path: string } | undefined {
    if (!uri.startsWith("npsharp-remote://")) return undefined;
    const parsed = new URL(uri); const hostId = decodeURIComponent(parsed.hostname);
    const session = [...this.sessions.values()].find(value => value.summary.hostId === hostId);
    if (!session) throw coded("REMOTE_CONNECTION_LOST", "Não há sessão conectada para esta URI.");
    return { sessionId: session.summary.id, path: decodeURIComponent(parsed.pathname) };
  }
  cancel(): void { this.abort?.abort(); }
  async disconnectAll(): Promise<void> { for (const id of [...this.sessions.keys()]) await this.disconnect(id); }
  private transition(status: RemoteConnectionState["status"], message: string, hostId?: string) { this.state = { ...this.state, hostId, status, message }; this.log("info", "connection", message); this.emit("remote:statusChanged", this.state); }
  private fail(error: unknown) { const value = error instanceof Error ? error : new Error(String(error)); this.state = { ...this.state, status: "failed", message: value.message }; this.log("error", "connection", value.message, { code: (value as Error & { code?: string }).code }); this.emit("remote:statusChanged", this.state); }
  private log(level: RemoteLogEntry["level"], scope: RemoteLogEntry["scope"], message: string, metadata?: Record<string, unknown>) { this.logs.push({ timestamp: new Date().toISOString(), level, scope, message, metadata }); if (this.logs.length > 1000) this.logs.shift(); }
}

class RemoteRpcClient {
  private id = 0; private pending = new Map<string, { resolve(value: unknown): void; reject(error: Error): void; timer: NodeJS.Timeout }>(); onClose?: () => void; onEvent?: (event: RpcEvent) => void;
  private constructor(private readonly socket: WebSocket) { socket.on("message", data => this.receive(data.toString())); socket.on("close", () => { for (const item of this.pending.values()) item.reject(coded("REMOTE_CONNECTION_LOST", "RPC remoto desconectado.")); this.pending.clear(); this.onClose?.(); }); }
  static connect(url: string): Promise<RemoteRpcClient> { return new Promise((resolve, reject) => { const socket = new WebSocket(url, { handshakeTimeout: 15_000 }); socket.once("open", () => resolve(new RemoteRpcClient(socket))); socket.once("error", error => reject(coded("REMOTE_WEBSOCKET_FAILED", error.message))); }); }
  request<T>(method: string, params: unknown): Promise<T> { const id = String(++this.id); return new Promise((resolve, reject) => { const timer = setTimeout(() => { this.pending.delete(id); reject(coded("REMOTE_RPC_TIMEOUT", `Timeout em ${method}.`)); }, RPC_TIMEOUT); this.pending.set(id, { resolve: value => resolve(value as T), reject, timer }); this.socket.send(JSON.stringify({ id, method, params })); }); }
  async close() { if (this.socket.readyState === WebSocket.CLOSED) return; this.onClose = undefined; await new Promise<void>(resolve => { this.socket.once("close", () => resolve()); this.socket.close(); setTimeout(resolve, 1000); }); }
  private receive(raw: string) { const message = JSON.parse(raw) as RpcResponse | RpcEvent; if ("event" in message) { this.onEvent?.(message); return; } const item = this.pending.get(message.id); if (!item) return; clearTimeout(item.timer); this.pending.delete(message.id); if (message.success) item.resolve(message.result); else item.reject(coded(message.error.code, message.error.message)); }
}

async function connectSsh(host: RemoteHostConfig, password: string | undefined, signal: AbortSignal, status: (value: "verifying-host-key" | "authenticating") => void): Promise<Client> { const client = new Client(); let keyFailure: Error | undefined; const options: ConnectConfig = { host: host.host, port: host.port || 22, username: host.username, readyTimeout: host.connectTimeout ?? 15_000, keepaliveInterval: host.keepAliveInterval ?? 10_000, keepaliveCountMax: 3, hostHash: "sha256", hostVerifier: (fingerprint: string) => { status("verifying-host-key"); if (!host.hostKeyFingerprint) { keyFailure = coded("REMOTE_HOST_KEY_UNKNOWN", `Fingerprint ${fingerprint}`); return false; } if (host.hostKeyFingerprint !== fingerprint) { keyFailure = coded("REMOTE_HOST_KEY_CHANGED", "A chave SSH do host mudou."); return false; } status("authenticating"); return true; } }; if (host.authMethod === "password") options.password = password; else if (host.authMethod === "key") options.privateKey = await fs.readFile(host.privateKeyPath, "utf8"); else if (process.env.SSH_AUTH_SOCK) options.agent = process.env.SSH_AUTH_SOCK; return new Promise((resolve, reject) => { const abort = () => { client.end(); reject(coded("REMOTE_CONNECTION_CANCELLED", "Conexão cancelada.")); }; signal.addEventListener("abort", abort, { once: true }); client.once("ready", () => { signal.removeEventListener("abort", abort); resolve(client); }); client.once("error", error => reject(keyFailure ?? coded("REMOTE_HOST_UNREACHABLE", error.message))); client.connect(options); }); }
async function detectPlatform(ssh: Client): Promise<RemotePlatformInfo> { const raw = await exec(ssh, "uname -s; uname -m; uname -r; printf '%s\\n' \"$HOME\"; printf '%s\\n' \"${TMPDIR:-/tmp}\"; printf '%s\\n' \"${SHELL:-/bin/sh}\"; command -v tar >/dev/null && echo 1 || echo 0; command -v unzip >/dev/null && echo 1 || echo 0; command -v node >/dev/null && echo 1 || echo 0; node --version 2>/dev/null || true; . /etc/os-release 2>/dev/null; printf '%s\\n%s\\n' \"${ID:-unknown}\" \"${VERSION_ID:-unknown}\""); const l = raw.trim().split("\n"); return { platform: l[0].toLowerCase().startsWith("linux") ? "linux" : l[0].toLowerCase().startsWith("darwin") ? "darwin" : "win32", architecture: normalizeArch(l[1]), kernel: l[2], homeDirectory: l[3], temporaryDirectory: l[4], defaultShell: l[5], hasTar: l[6] === "1", hasUnzip: l[7] === "1", hasNode: l[8] === "1", nodeVersion: l[9]?.startsWith("v") ? l[9] : undefined, distribution: l.at(-2), distributionVersion: l.at(-1) }; }
function normalizeArch(value: string) { return value === "x86_64" ? "x64" : value === "aarch64" ? "arm64" : value; }
function remotePaths(home: string, version: string, sessionId: string) { const base = `${home}/.npsharp-server`; const install = `${base}/bin/${version}`; return { base, install, server: `${install}/server`, marker: `${install}/install-complete`, tmp: `${base}/tmp/install-${sessionId}`, bootstrap: `${base}/sessions/${sessionId}.json`, log: `${base}/logs/${sessionId}.log`, sessionId }; }
async function ensureInstalled(ssh: Client, localDist: string, p: ReturnType<typeof remotePaths>, platform: RemotePlatformInfo, signal: AbortSignal, progress: (phase: "uploading-server" | "installing-server") => void) { const checksum = crypto.createHash("sha256").update(await fs.readFile(path.join(localDist, "index.js"))).digest("hex"); const marker = `${BUILD_CONFIG.version}:1:${platform.platform}:${platform.architecture}:${checksum}`; const valid = (await exec(ssh, `test -f ${quote(p.marker)} && test -f ${quote(p.server + "/package.json")} && cat ${quote(p.marker)} || true`)).trim() === marker; if (valid) return; progress("uploading-server"); await exec(ssh, `mkdir -p ${quote(p.tmp + "/server/security")} ${quote(p.tmp + "/server/node_modules/ws")} ${quote(p.tmp + "/server/node_modules/node-pty")} ${quote(p.base + "/sessions")} ${quote(p.base + "/logs")} && chmod 700 ${quote(p.base)} ${quote(p.base + "/sessions")} ${quote(p.base + "/logs")}`); const sftp = await getSftp(ssh); await uploadTree(sftp, localDist, p.tmp + "/server", signal); const serverPackage = path.join(path.dirname(localDist), "package.json"); await fastPut(sftp, serverPackage, p.tmp + "/server/package.json"); const wsRoot = path.dirname(require.resolve("ws/package.json")); await uploadTree(sftp, wsRoot, p.tmp + "/server/node_modules/ws", signal); const remoteChecksum = (await exec(ssh, `sha256sum ${quote(p.tmp + "/server/index.js")} | cut -d\x27 \x27 -f1`)).trim(); if (remoteChecksum !== checksum) throw coded("REMOTE_SERVER_CHECKSUM_MISMATCH", "Checksum do NPSharp Server não confere."); const ptyRoot = path.dirname(require.resolve("node-pty/package.json")); await uploadTree(sftp, ptyRoot, p.tmp + "/server/node_modules/node-pty", signal); progress("installing-server"); await exec(ssh, `rm -rf ${quote(p.install + ".old")} && if test -d ${quote(p.install)}; then mv ${quote(p.install)} ${quote(p.install + ".old")}; fi && mv ${quote(p.tmp)} ${quote(p.install)} && printf '%s' ${quote(marker)} > ${quote(p.marker)} && chmod -R u=rwX,go= ${quote(p.install)} && rm -rf ${quote(p.install + ".old")}`); }
async function launchServer(ssh: Client, p: ReturnType<typeof remotePaths>, home: string) { const command = `NPSHARP_SESSION_ID=${quote(p.sessionId)} NPSHARP_BOOTSTRAP_FILE=${quote(p.bootstrap)} NPSHARP_LOG_FILE=${quote(p.log)} NPSHARP_ALLOWED_ROOTS=${quote(home)} nohup node ${quote(p.server + "/index.js")} >> ${quote(p.log)} 2>&1 < /dev/null &`; await exec(ssh, command); }
async function waitForBootstrap(ssh: Client, target: string, signal: AbortSignal) { const end = Date.now() + 15_000; while (Date.now() < end) { if (signal.aborted) throw coded("REMOTE_CONNECTION_CANCELLED", "Conexão cancelada."); const raw = await exec(ssh, `test -f ${quote(target)} && cat ${quote(target)} || true`); if (raw.trim()) { try { return JSON.parse(raw) as RemoteServerBootstrap; } catch { throw coded("REMOTE_SERVER_INVALID_BOOTSTRAP", "Bootstrap remoto inválido."); } } await new Promise(resolve => setTimeout(resolve, 250)); } throw coded("REMOTE_SERVER_BOOTSTRAP_TIMEOUT", "Timeout aguardando bootstrap remoto."); }
function validateBootstrap(value: RemoteServerBootstrap) { if (!value || value.host !== "127.0.0.1" || !Number.isInteger(value.port) || value.port < 1 || value.version !== BUILD_CONFIG.version || value.protocolVersion !== PROTOCOL_VERSION || typeof value.token !== "string" || value.token.length < 32) throw coded("REMOTE_SERVER_INVALID_BOOTSTRAP", "Bootstrap remoto incompatível."); }
async function openTunnel(ssh: Client, remotePort: number) { const server = net.createServer(socket => ssh.forwardOut("127.0.0.1", 0, "127.0.0.1", remotePort, (error, stream) => { if (error) { socket.destroy(error); return; } socket.pipe(stream).pipe(socket); })); return { server, port: await new Promise<number>((resolve, reject) => { server.once("error", reject); server.listen(0, "127.0.0.1", () => { const address = server.address(); if (address && typeof address !== "string") resolve(address.port); else reject(new Error("Túnel inválido.")); }); }) }; }
async function getSftp(ssh: Client) { return new Promise<SFTPWrapper>((resolve, reject) => ssh.sftp((error, sftp) => error ? reject(error) : resolve(sftp))); }
async function uploadTree(sftp: SFTPWrapper, local: string, remote: string, signal?: AbortSignal): Promise<void> { if (signal?.aborted) throw coded("REMOTE_CONNECTION_CANCELLED", "Conexão cancelada."); await sftpMkdir(sftp, remote); for (const entry of await fs.readdir(local, { withFileTypes: true })) { const l = path.join(local, entry.name); const r = `${remote}/${entry.name}`; if (entry.isDirectory()) await uploadTree(sftp, l, r, signal); else if (entry.isFile()) await fastPut(sftp, l, r); } }
function sftpMkdir(sftp: SFTPWrapper, target: string) { return new Promise<void>(resolve => sftp.mkdir(target, () => resolve())); }
function fastPut(sftp: SFTPWrapper, local: string, remote: string) { return new Promise<void>((resolve, reject) => sftp.fastPut(local, remote, error => error ? reject(error) : resolve())); }
function exec(ssh: Client, command: string) { return new Promise<string>((resolve, reject) => ssh.exec(command, (error, stream) => { if (error) return reject(error); let out = "", err = ""; stream.on("data", (data: Buffer) => out += data); stream.stderr.on("data", data => err += data); stream.on("close", (code: number) => code === 0 ? resolve(out) : reject(new Error(err || out || `Exit ${code}`))); })); }
function quote(value: string) { return `'${value.replace(/'/g, `'"'"'`)}'`; }
function coded(code: string, message: string) { return Object.assign(new Error(message), { code }); }
function required<K, V>(map: Map<K, V>, key: K) { const value = map.get(key); if (!value) throw coded("REMOTE_CONNECTION_LOST", "Sessão remota não encontrada."); return value; }
function closeServer(server?: net.Server) { return new Promise<void>(resolve => server?.close(() => resolve()) ?? resolve()); }
function withoutToken(value: RemoteServerBootstrap): Omit<RemoteServerBootstrap, "token"> { const { token: _token, ...safe } = value; return safe; }
