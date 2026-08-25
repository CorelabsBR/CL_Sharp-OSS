/*---------------------------------------------------------------------------------------------
- Copyright (c) CorelabsBR. All rights reserved.
- Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
import { shell } from "electron";
import fs from "node:fs/promises";
import http, { type Server } from "node:http";
import net from "node:net";
import path from "node:path";
import { spawn, type ChildProcess } from "node:child_process";
import type { GitOperationResult, LiveServerRequest, LiveServerResult } from "../../shared/types";
import { commandExists } from "./processService";

const HOST = "127.0.0.1";
const HTML_BASE_PORT = 5500;
const PHP_BASE_PORT = 8000;

let htmlServer: Server | undefined;
let htmlRoot = "";
let htmlPort = -1;
let phpProcess: ChildProcess | undefined;
let phpRoot = "";
let phpPort = -1;

export async function openLiveServer(request: LiveServerRequest): Promise<LiveServerResult> {
  const workspace = path.resolve(request.workspace);
  const filePath = path.resolve(request.filePath);
  const extension = path.extname(filePath).toLowerCase();

  if (!isPathInside(filePath, workspace)) {
    return { success: false, output: "Arquivo fora da pasta do projeto." };
  }

  if (extension === ".html" || extension === ".htm") {
    return openHtml(filePath, workspace);
  }

  if (extension === ".php") {
    return openPhp(filePath, workspace);
  }

  return { success: false, output: "Live Server suporta HTML e PHP neste momento." };
}

export async function stopAllLiveServers(): Promise<GitOperationResult> {
  if (htmlServer) {
    htmlServer.close();
    htmlServer = undefined;
    htmlRoot = "";
    htmlPort = -1;
  }
  if (phpProcess) {
    phpProcess.kill();
    phpProcess = undefined;
    phpRoot = "";
    phpPort = -1;
  }
  return { success: true, output: "Live Server parado" };
}

async function openHtml(filePath: string, workspace: string): Promise<LiveServerResult> {
  if (!htmlServer || htmlRoot !== workspace) {
    if (htmlServer) htmlServer.close();
    htmlPort = await findFreePort(HTML_BASE_PORT);
    htmlRoot = workspace;
    htmlServer = http.createServer((req, res) => {
      void handleStaticRequest(req.url ?? "/", htmlRoot, res);
    });
    await new Promise<void>(resolve => htmlServer!.listen(htmlPort, HOST, resolve));
  }

  const url = buildUrl(htmlPort, workspace, filePath);
  await shell.openExternal(url);
  return { success: true, output: `Live Server HTML: ${url}`, url };
}

async function openPhp(filePath: string, workspace: string): Promise<LiveServerResult> {
  const php = await commandExists("php");
  if (!php) {
    return { success: false, output: "PHP não encontrado no PATH. Instale PHP ou configure o caminho do executável." };
  }

  if (!phpProcess || !phpRoot || phpRoot !== workspace || phpProcess.killed) {
    if (phpProcess) phpProcess.kill();
    phpPort = await findFreePort(PHP_BASE_PORT);
    phpRoot = workspace;
    phpProcess = spawn(php, ["-S", `${HOST}:${phpPort}`, "-t", workspace], {
      cwd: workspace,
      shell: false,
      stdio: "ignore",
      windowsHide: true
    });
    await new Promise(resolve => setTimeout(resolve, 350));
  }

  const url = buildUrl(phpPort, workspace, filePath);
  await shell.openExternal(url);
  return { success: true, output: `Live Server PHP: ${url}`, url };
}

async function handleStaticRequest(rawUrl: string, root: string, res: http.ServerResponse): Promise<void> {
  try {
    const decoded = decodeURIComponent(rawUrl.split("?")[0].replace(/^\/+/, ""));
    let requested = path.resolve(root, decoded);
    if (!isPathInside(requested, root)) {
      send(res, 403, "Forbidden", "text/plain; charset=utf-8");
      return;
    }

    const stat = await fs.stat(requested).catch(() => undefined);
    if (stat?.isDirectory()) {
      requested = path.join(requested, "index.html");
    }

    const fileStat = await fs.stat(requested).catch(() => undefined);
    if (!fileStat?.isFile()) {
      send(res, 404, "Not Found", "text/plain; charset=utf-8");
      return;
    }

    const data = await fs.readFile(requested);
    res.writeHead(200, { "Content-Type": contentType(requested) });
    res.end(data);
  } catch (error) {
    console.warn(`[Sharp-OSS liveServer] Failed to serve ${rawUrl}`, error);
    send(res, 500, "Internal Server Error", "text/plain; charset=utf-8");
  }
}

function send(res: http.ServerResponse, code: number, text: string, contentTypeValue: string): void {
  res.writeHead(code, { "Content-Type": contentTypeValue });
  res.end(text);
}

function buildUrl(port: number, root: string, target: string): string {
  const relative = path.relative(root, target).replace(/\\/g, "/");
  return `http://${HOST}:${port}/${encodePathForUrl(relative)}`;
}

function isPathInside(candidate: string, root: string): boolean {
  const relative = path.relative(root, candidate);
  return relative === "" || (!relative.startsWith("..") && !path.isAbsolute(relative));
}

function encodePathForUrl(value: string): string {
  return value.split("/").map(segment => encodeURIComponent(segment)).join("/");
}

async function findFreePort(start: number): Promise<number> {
  for (let port = start; port < start + 200; port++) {
    if (await isPortFree(port)) return port;
  }
  throw new Error(`Nenhuma porta livre encontrada a partir de ${start}`);
}

function isPortFree(port: number): Promise<boolean> {
  return new Promise(resolve => {
    const server = net.createServer();
    server.once("error", () => resolve(false));
    server.once("listening", () => {
      server.close(() => resolve(true));
    });
    server.listen(port, HOST);
  });
}

function contentType(file: string): string {
  switch (path.extname(file).toLowerCase()) {
    case ".html":
    case ".htm":
      return "text/html; charset=utf-8";
    case ".css":
      return "text/css; charset=utf-8";
    case ".js":
    case ".mjs":
      return "application/javascript; charset=utf-8";
    case ".json":
      return "application/json; charset=utf-8";
    case ".svg":
      return "image/svg+xml";
    case ".png":
      return "image/png";
    case ".jpg":
    case ".jpeg":
      return "image/jpeg";
    case ".gif":
      return "image/gif";
    case ".webp":
      return "image/webp";
    case ".ico":
      return "image/x-icon";
    case ".txt":
      return "text/plain; charset=utf-8";
    default:
      return "application/octet-stream";
  }
}
