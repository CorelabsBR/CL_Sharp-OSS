/*---------------------------------------------------------------------------------------------
- Copyright (c) CorelabsBR. All rights reserved.
- Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
import assert from "node:assert/strict";
import crypto from "node:crypto";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { spawn } from "node:child_process";
import { WebSocket } from "ws";

const temporaryDirectory = await fs.mkdtemp(path.join(os.tmpdir(), "sharp-server-test-"));
const bootstrapFile = path.join(temporaryDirectory, "bootstrap.json");
const logFile = path.join(temporaryDirectory, "server.log");
await fs.writeFile(path.join(temporaryDirectory, "remote-search.txt"), "Sharp-OSS remote context\n", "utf8");
const serverFile = path.resolve("sharp-server/dist/index.js");
const child = spawn(process.execPath, [serverFile], {
  env: {
    ...process.env,
    SHARP_BOOTSTRAP_FILE: bootstrapFile,
    SHARP_LOG_FILE: logFile,
    SHARP_ALLOWED_ROOTS: temporaryDirectory
  },
  stdio: ["ignore", "pipe", "pipe"]
});

try {
  const bootstrap = await waitForBootstrap();
  assert.equal(bootstrap.host, "127.0.0.1");
  assert.ok(bootstrap.port > 0);
  assert.ok(bootstrap.token.length >= 32);

  const socket = await connect(`ws://${bootstrap.host}:${bootstrap.port}/?token=${encodeURIComponent(bootstrap.token)}`);
  const response = await request(socket, "system.capabilities");
  assert.equal(response.success, true);
  assert.equal(response.result.filesystem, true);
  assert.equal(response.result.workspace, true);
  assert.equal(response.result.process, true);
  assert.equal(response.result.watch, true);
  assert.equal(response.result.watchers, true);
  assert.equal(response.result.search, true);
  assert.equal(response.result.extensions, true);
  assert.equal(new Set(response.result.capabilities).size, response.result.capabilities.length);
  const search = await request(socket, "search.workspace", { workspace: temporaryDirectory, text: "remote context", caseSensitive: false, wholeWord: false });
  assert.equal(search.success, true);
  assert.equal(search.result.length, 1);
  const extensions = await request(socket, "extensions.list");
  assert.equal(extensions.success, true);
  assert.ok(Array.isArray(extensions.result));
  socket.close();
} finally {
  child.kill("SIGTERM");
  if (child.exitCode === null && child.signalCode === null) {
    await new Promise(resolve => child.once("close", resolve));
  }
  await fs.rm(temporaryDirectory, { recursive: true, force: true });
}

async function waitForBootstrap() {
  const deadline = Date.now() + 5_000;
  while (Date.now() < deadline) {
    const raw = await fs.readFile(bootstrapFile, "utf8").catch(() => "");
    if (raw) return JSON.parse(raw);
    if (child.exitCode !== null) throw new Error(`Servidor encerrou com código ${child.exitCode}.`);
    await new Promise(resolve => setTimeout(resolve, 25));
  }
  throw new Error("Timeout aguardando bootstrap no teste.");
}

function connect(url) {
  return new Promise((resolve, reject) => {
    const socket = new WebSocket(url);
    socket.once("open", () => resolve(socket));
    socket.once("error", reject);
  });
}

function request(socket, method, params = {}) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`Timeout em ${method}.`)), 2_000);
    socket.once("message", data => {
      clearTimeout(timer);
      resolve(JSON.parse(data.toString()));
    });
    socket.send(JSON.stringify({ id: crypto.randomUUID(), method, params }));
  });
}
