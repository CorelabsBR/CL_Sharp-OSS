/*---------------------------------------------------------------------------------------------
- Copyright (c) CorelabsBR. All rights reserved.
- Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
import fs from "node:fs/promises";
import path from "node:path";
import crypto from "node:crypto";
import { Client, type ConnectConfig, type SFTPWrapper } from "ssh2";
import type {
  FileReadResult,
  GitOperationResult,
  RemoteCommandRequest,
  RemoteFileRequest,
  RemoteHostConfig,
  RemoteListRequest,
  WorkspaceEntry
} from "../../shared/types";
import { remoteHostsPath } from "./paths";

export async function loadHosts(): Promise<RemoteHostConfig[]> {
  try {
    const raw = await fs.readFile(remoteHostsPath(), "utf8");
    const hosts = JSON.parse(raw) as RemoteHostConfig[];
    return hosts.map(host => ({ ...host, id: host.id || crypto.createHash("sha256").update(`${host.username}@${host.host}:${host.port}`).digest("hex").slice(0, 16) }));
  } catch {
    return [];
  }
}

export async function saveHosts(hosts: RemoteHostConfig[]): Promise<void> {
  await fs.mkdir(path.dirname(remoteHostsPath()), { recursive: true });
  const safeHosts = (hosts ?? []).map(host => {
    const clean = { ...host } as RemoteHostConfig & { password?: string };
    delete clean.password;
    clean.id ||= crypto.randomUUID();
    return clean;
  });
  await fs.writeFile(remoteHostsPath(), JSON.stringify(safeHosts, null, 2) + "\n", { encoding: "utf8", mode: 0o600 });
}

export async function testRemote(request: RemoteCommandRequest): Promise<GitOperationResult> {
  return executeRemote({ ...request, command: "pwd" });
}

export async function executeRemote(request: RemoteCommandRequest): Promise<GitOperationResult> {
  const validation = validateRequest(request.config, request.password);
  if (validation) {
    return { success: false, output: validation };
  }

  try {
    return await withClient(request.config, request.password, client => exec(client, request.command));
  } catch (error) {
    return { success: false, output: remoteFailure("executar comando", error) };
  }
}

export async function listRemote(request: RemoteListRequest): Promise<WorkspaceEntry[]> {
  return withSftp(request.config, request.password, sftp => new Promise((resolve, reject) => {
    const base = normalizeRemotePath(request.config, request.path);
    sftp.readdir(base, (error, list) => {
      if (error) {
        reject(new Error(remoteFailure("listar", error)));
        return;
      }
      resolve(
        list
          .filter(item => item.filename !== "." && item.filename !== "..")
          .map(item => ({
            path: joinRemote(base, item.filename),
            name: item.filename,
            directory: item.attrs.isDirectory(),
            size: item.attrs.size,
            modifiedAt: item.attrs.mtime * 1000,
            hidden: item.filename.startsWith(".")
          }))
          .sort((a, b) => a.directory !== b.directory ? (a.directory ? -1 : 1) : a.name.localeCompare(b.name, undefined, { sensitivity: "base" }))
      );
    });
  }));
}

export async function readRemoteFile(request: RemoteFileRequest): Promise<FileReadResult> {
  return withSftp(request.config, request.password, sftp => new Promise((resolve, reject) => {
    sftp.readFile(request.path, (error, data) => {
      if (error) {
        reject(new Error(remoteFailure("abrir", error)));
        return;
      }
      const content = Buffer.isBuffer(data) ? data.toString("utf8") : String(data);
      sftp.stat(request.path, (statError, stats) => {
        if (statError) { reject(new Error(remoteFailure("obter metadados", statError))); return; }
        resolve({
          path: request.path,
          name: path.posix.basename(request.path),
          content,
          lineEnding: content.includes("\r\n") ? "\r\n" : "\n",
          encoding: "utf8",
          remoteMetadata: { mtimeMs: stats.mtime * 1000, size: stats.size, etag: etag(Buffer.from(data)) }
        });
      });
    });
  }));
}

export async function writeRemoteFile(request: RemoteFileRequest): Promise<void> {
  await withSftp(request.config, request.password, sftp => new Promise<void>((resolve, reject) => {
    sftp.readFile(request.path, (readError, current) => {
      if (readError && request.etag) { reject(new Error(remoteFailure("verificar arquivo", readError))); return; }
      if (request.etag && !request.overwrite && etag(Buffer.from(current ?? "")) !== request.etag) {
        reject(new Error("REMOTE_FILE_MODIFIED: o arquivo foi alterado no servidor."));
        return;
      }
      sftp.writeFile(request.path, Buffer.from(request.content ?? "", "utf8"), error => {
        if (error) reject(new Error(remoteFailure("salvar", error)));
        else resolve();
      });
    });
  }));
}

export async function mkdirRemote(request: RemoteFileRequest): Promise<void> {
  await withSftp(request.config, request.password, sftp => new Promise<void>((resolve, reject) => {
    sftp.mkdir(request.path, error => {
      if (error) reject(new Error(remoteFailure("criar pasta", error)));
      else resolve();
    });
  }));
}

export async function touchRemote(request: RemoteFileRequest): Promise<void> {
  await writeRemoteFile({ ...request, content: request.content ?? "" });
}

export async function renameRemote(request: RemoteFileRequest & { newPath: string }): Promise<void> {
  await withSftp(request.config, request.password, sftp => new Promise<void>((resolve, reject) => {
    sftp.rename(request.path, request.newPath, error => {
      if (error) reject(new Error(remoteFailure("renomear", error)));
      else resolve();
    });
  }));
}

export async function deleteRemote(request: RemoteFileRequest): Promise<void> {
  await withSftp(request.config, request.password, sftp => deleteRemotePath(sftp, request.path));
}

async function withSftp<T>(config: RemoteHostConfig, password: string | undefined, fn: (sftp: SFTPWrapper) => Promise<T>): Promise<T> {
  return withClient(config, password, client => new Promise<T>((resolve, reject) => {
    client.sftp((error, sftp) => {
      if (error) {
        reject(new Error(remoteFailure("conectar sftp", error)));
        return;
      }
      fn(sftp).then(resolve, reject);
    });
  }));
}

async function withClient<T>(config: RemoteHostConfig, password: string | undefined, fn: (client: Client) => Promise<T>): Promise<T> {
  const validation = validateRequest(config, password);
  if (validation) throw new Error(validation);
  const client = await connect(config, password);
  try {
    return await fn(client);
  } finally {
    client.end();
  }
}

async function connect(config: RemoteHostConfig, password: string | undefined): Promise<Client> {
  const client = new Client();
  let hostKeyFailure: string | undefined;
  const options: ConnectConfig = {
    host: config.host,
    port: config.port || 22,
    username: config.username,
    readyTimeout: config.connectTimeout ?? 15000,
    keepaliveInterval: config.keepAliveInterval ?? 10000,
    keepaliveCountMax: 3,
    hostHash: "sha256",
    hostVerifier: (fingerprint: string) => {
      if (!config.hostKeyFingerprint) {
        hostKeyFailure = `REMOTE_HOST_KEY_UNKNOWN:${fingerprint}`;
        return false;
      }
      if (config.hostKeyFingerprint !== fingerprint) {
        hostKeyFailure = `REMOTE_HOST_KEY_CHANGED:${fingerprint}`;
        return false;
      }
      return true;
    }
  };

  if (config.authMethod === "password") {
    options.password = password ?? "";
  } else if (config.authMethod === "key") {
    options.privateKey = await fs.readFile(config.privateKeyPath, "utf8");
  } else if (process.env.SSH_AUTH_SOCK) {
    options.agent = process.env.SSH_AUTH_SOCK;
  }

  return new Promise((resolve, reject) => {
    client.once("ready", () => resolve(client));
    client.once("error", error => reject(new Error(hostKeyFailure ?? remoteFailure("conectar", error))));
    client.connect(options);
  });
}

function exec(client: Client, command: string): Promise<GitOperationResult> {
  if (!command?.trim()) {
    return Promise.resolve({ success: false, output: "Informe um comando remoto." });
  }
  return new Promise((resolve, reject) => {
    client.exec(command, (error, stream) => {
      if (error) {
        reject(new Error(remoteFailure("executar comando", error)));
        return;
      }
      let output = "";
      stream.on("data", (chunk: Buffer) => {
        output += chunk.toString();
      });
      stream.stderr.on("data", (chunk: Buffer) => {
        output += chunk.toString();
      });
      stream.on("close", (code: number) => {
        const exitLine = code === 0 ? "" : `${output ? "\n" : ""}[remote] exit code ${code}`;
        resolve({ success: code === 0, output: `${output.trimEnd()}${exitLine}`.trim() });
      });
    });
  });
}

function deleteRemotePath(sftp: SFTPWrapper, remotePath: string): Promise<void> {
  return new Promise((resolve, reject) => {
    sftp.stat(remotePath, (statError, stats) => {
      if (statError) {
        reject(new Error(remoteFailure("excluir", statError)));
        return;
      }
      if (!stats.isDirectory()) {
        sftp.unlink(remotePath, error => error ? reject(new Error(remoteFailure("excluir", error))) : resolve());
        return;
      }
      sftp.readdir(remotePath, async (readError, list) => {
        if (readError) {
          reject(new Error(remoteFailure("excluir", readError)));
          return;
        }
        try {
          for (const item of list) {
            if (item.filename === "." || item.filename === "..") continue;
            await deleteRemotePath(sftp, joinRemote(remotePath, item.filename));
          }
          sftp.rmdir(remotePath, error => error ? reject(new Error(remoteFailure("excluir", error))) : resolve());
        } catch (error) {
          reject(error);
        }
      });
    });
  });
}

function validateRequest(config: RemoteHostConfig, password: string | undefined): string | undefined {
  if (!config) return "Configuracao de Host Remoto invalida.";
  if (!config.host) return "Informe o Host Remoto.";
  if (!config.username) return "Informe o usuario remoto.";
  if (config.port <= 0 || config.port > 65535) return "Porta SSH invalida.";
  if (config.authMethod === "password" && password === undefined) return "Senha obrigatoria para autenticacao por senha.";
  if (config.authMethod === "key" && !config.privateKeyPath) return "Informe o caminho da chave privada.";
  if (config.authMethod === "agent" && !process.env.SSH_AUTH_SOCK) return "SSH agent nao encontrado em SSH_AUTH_SOCK.";
  return undefined;
}

function normalizeRemotePath(config: RemoteHostConfig, remotePath: string): string {
  if (!remotePath?.trim()) {
    return config.defaultPath?.trim() || ".";
  }
  return remotePath.trim();
}

function joinRemote(parent: string, name: string): string {
  const base = parent || ".";
  return base.endsWith("/") ? `${base}${name}` : `${base}/${name}`;
}

function remoteFailure(action: string, error: unknown): string {
  return `Falha ao ${action} remoto: ${friendly(error)}`;
}

function friendly(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error);
  const lower = message.toLowerCase();
  if (message.includes("REMOTE_HOST_KEY_UNKNOWN:")) return `Chave do host ainda não confiável. Fingerprint ${message.split("REMOTE_HOST_KEY_UNKNOWN:")[1]}`;
  if (message.includes("REMOTE_HOST_KEY_CHANGED:")) return "REMOTE_HOST_KEY_CHANGED: a chave SSH do host mudou; conexão bloqueada.";
  if (lower.includes("all configured authentication methods failed") || lower.includes("auth")) {
    return "Autenticacao recusada. Confira usuario, senha ou chave privada.";
  }
  if (lower.includes("timeout") || lower.includes("timed out")) {
    return "Tempo esgotado ao conectar. Confira host, porta e rede.";
  }
  if (lower.includes("connection refused")) {
    return "Conexao recusada. Confira host, porta e servico SSH.";
  }
  if (lower.includes("getaddrinfo") || lower.includes("unknown host")) {
    return "Host Remoto nao encontrado.";
  }
  if (lower.includes("permission")) {
    return "Permissao negada no Host Remoto.";
  }
  if (lower.includes("no such file") || lower.includes("not found")) {
    return "Caminho remoto invalido ou inexistente.";
  }
  return message || "Operacao remota nao concluida.";
}

function etag(content: Buffer): string {
  return crypto.createHash("sha256").update(content).digest("hex");
}
