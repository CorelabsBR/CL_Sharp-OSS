import { spawn } from "node:child_process";
import fs from "node:fs/promises";
import http from "node:http";
import net from "node:net";
import path from "node:path";
import process from "node:process";

const root = path.resolve(new URL("..", import.meta.url).pathname);
const npm = process.platform === "win32" ? "npm.cmd" : "npm";
const electron = process.platform === "win32"
  ? path.join(root, "node_modules", ".bin", "electron.cmd")
  : path.join(root, "node_modules", ".bin", "electron");
const requestedDevServerUrl = process.env.VITE_DEV_SERVER_URL;
const requestedDevServerPort = requestedDevServerUrl ? Number(new URL(requestedDevServerUrl).port || 5173) : 5173;
const devServerPort = requestedDevServerUrl ? requestedDevServerPort : await findAvailablePort(requestedDevServerPort);
const devServerUrl = requestedDevServerUrl ?? `http://127.0.0.1:${devServerPort}`;
const mainFile = path.join(root, "dist-electron", "main", "main.js");
const children = [];

function spawnChild(command, args, extraEnv = {}) {
  const env = { ...process.env, ...extraEnv };
  delete env.ELECTRON_RUN_AS_NODE;
  const child = spawn(command, args, { cwd: root, stdio: "inherit", shell: false, env });
  children.push(child);
  return child;
}

async function waitForFile(file) {
  for (let i = 0; i < 120; i++) {
    try {
      await fs.access(file);
      return;
    } catch {
      await new Promise(resolve => setTimeout(resolve, 250));
    }
  }
  throw new Error(`Timed out waiting for ${file}`);
}

async function waitForUrl(url) {
  for (let i = 0; i < 120; i++) {
    const ok = await new Promise(resolve => {
      const request = http.get(url, response => {
        response.resume();
        resolve(Boolean(response.statusCode && response.statusCode < 500));
      });
      request.on("error", () => resolve(false));
      request.setTimeout(500, () => {
        request.destroy();
        resolve(false);
      });
    });
    if (ok) return;
    await new Promise(resolve => setTimeout(resolve, 250));
  }
  throw new Error(`Timed out waiting for ${url}`);
}

async function findAvailablePort(startPort) {
  for (let port = startPort; port < startPort + 20; port++) {
    const available = await new Promise(resolve => {
      const server = net.createServer();
      server.once("error", () => resolve(false));
      server.once("listening", () => {
        server.close(() => resolve(true));
      });
      server.listen(port, "127.0.0.1");
    });
    if (available) return port;
  }
  throw new Error(`No available dev server port from ${startPort} to ${startPort + 19}`);
}

function shutdown(code = 0) {
  for (const child of children) {
    if (!child.killed) child.kill();
  }
  process.exit(code);
}

process.on("SIGINT", () => shutdown(0));
process.on("SIGTERM", () => shutdown(0));

spawnChild(npm, ["run", "build:electron", "--", "--watch"]);
spawnChild(npm, ["run", "dev:renderer"], { VITE_PORT: String(devServerPort), VITE_DEV_SERVER_URL: devServerUrl });

await waitForFile(mainFile);
await waitForUrl(devServerUrl);

const electronProcess = spawnChild(electron, ["."], { VITE_DEV_SERVER_URL: devServerUrl });
electronProcess.on("exit", code => shutdown(code ?? 0));
