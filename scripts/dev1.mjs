/*---------------------------------------------------------------------------------------------
- Copyright (c) CorelabsBR. All rights reserved.
- Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { spawn } from "node:child_process";
import { unwatchFile, watchFile } from "node:fs";
import fs from "node:fs/promises";
import http from "node:http";
import net from "node:net";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

/**
 * Diretório raiz do projeto.
 */
const root = path.resolve(
  fileURLToPath(new URL("..", import.meta.url))
);

const isWindows = process.platform === "win32";

/**
 * No Windows, .cmd não deve ser executado diretamente com shell: false.
 *
 * Por isso usamos apenas "npm" e deixamos o shell do Windows resolver
 * npm.cmd automaticamente.
 */
const npm = "npm";

/**
 * Electron local do projeto.
 *
 * No Windows usamos electron.cmd através do shell.
 */
const electron = isWindows
  ? path.join(root, "node_modules", ".bin", "electron.cmd")
  : path.join(root, "node_modules", ".bin", "electron");

/**
 * Configuração do servidor Vite.
 */
const requestedDevServerUrl = process.env.VITE_DEV_SERVER_URL;

const requestedDevServerPort = requestedDevServerUrl
  ? Number(new URL(requestedDevServerUrl).port || 5173)
  : 5173;

const devServerPort = requestedDevServerUrl
  ? requestedDevServerPort
  : await findAvailablePort(requestedDevServerPort);

const devServerUrl =
  requestedDevServerUrl ?? `http://127.0.0.1:${devServerPort}`;

/**
 * Arquivos gerados pelo build do Electron.
 */
const mainFile = path.join(
  root,
  "dist-electron",
  "main",
  "main.js"
);

const preloadFile = path.join(
  root,
  "dist-electron",
  "preload",
  "preload.js"
);

const watchedOutputFiles = [
  mainFile,
  preloadFile,
];

const children = [];

let electronProcess = null;
let restartTimer = null;
let restartingElectron = false;
let shuttingDown = false;

/**
 * Inicia um processo filho.
 *
 * IMPORTANTE:
 * No Windows usamos shell: true porque npm.cmd/electron.cmd
 * não funcionam corretamente em algumas versões do Node
 * quando executados diretamente com shell: false.
 */
function spawnChild(command, args = [], extraEnv = {}) {
  const env = {
    ...process.env,
    ...extraEnv,
  };

  /**
   * Pode fazer o Electron iniciar como Node caso esteja definido.
   * Removemos explicitamente.
   */
  delete env.ELECTRON_RUN_AS_NODE;

  console.log(
    `[dev] Iniciando: ${command} ${args.join(" ")}`
  );

  const child = spawn(command, args, {
    cwd: root,
    stdio: "inherit",

    /**
     * Correção principal para Windows.
     */
    shell: isWindows,

    env,
  });

  children.push(child);

  child.on("error", error => {
    console.error(
      `\n[dev] Falha ao iniciar "${command}":`
    );

    console.error(error);

    if (!shuttingDown) {
      shutdown(1);
    }
  });

  return child;
}

/**
 * Aguarda um arquivo existir.
 */
async function waitForFile(file) {
  console.log(`[dev] Aguardando arquivo: ${file}`);

  for (let i = 0; i < 120; i++) {
    try {
      await fs.access(file);

      console.log(`[dev] Arquivo encontrado: ${file}`);

      return;
    } catch {
      await sleep(250);
    }
  }

  throw new Error(
    `Timed out waiting for ${file}`
  );
}

/**
 * Aguarda o Vite responder.
 */
async function waitForUrl(url) {
  console.log(`[dev] Aguardando servidor: ${url}`);

  for (let i = 0; i < 120; i++) {
    const ok = await new Promise(resolve => {
      const request = http.get(
        url,
        response => {
          response.resume();

          resolve(
            Boolean(
              response.statusCode &&
              response.statusCode < 500
            )
          );
        }
      );

      request.on("error", () => {
        resolve(false);
      });

      request.setTimeout(500, () => {
        request.destroy();
        resolve(false);
      });
    });

    if (ok) {
      console.log(
        `[dev] Servidor disponível: ${url}`
      );

      return;
    }

    await sleep(250);
  }

  throw new Error(
    `Timed out waiting for ${url}`
  );
}

/**
 * Procura uma porta disponível para o Vite.
 */
async function findAvailablePort(startPort) {
  for (
    let port = startPort;
    port < startPort + 20;
    port++
  ) {
    const available = await new Promise(resolve => {
      const server = net.createServer();

      server.once("error", () => {
        resolve(false);
      });

      server.once("listening", () => {
        server.close(() => {
          resolve(true);
        });
      });

      server.listen(
        port,
        "127.0.0.1"
      );
    });

    if (available) {
      return port;
    }
  }

  throw new Error(
    `No available dev server port from ${startPort} to ${
      startPort + 19
    }`
  );
}

/**
 * Pequeno helper para delays.
 */
function sleep(ms) {
  return new Promise(resolve => {
    setTimeout(resolve, ms);
  });
}

/**
 * Encerra os processos do ambiente de desenvolvimento.
 */
function shutdown(code = 0) {
  if (shuttingDown) {
    return;
  }

  shuttingDown = true;

  console.log("\n[dev] Encerrando ambiente...");

  if (restartTimer) {
    clearTimeout(restartTimer);
  }

  for (const file of watchedOutputFiles) {
    unwatchFile(file);
  }

  for (const child of children) {
    try {
      if (
        child &&
        !child.killed &&
        child.exitCode === null
      ) {
        child.kill();
      }
    } catch {
      // Processo já encerrado.
    }
  }

  process.exit(code);
}

/**
 * Inicializa Electron.
 */
function startElectron() {
  console.log(
    `[dev] Iniciando Electron em ${devServerUrl}`
  );

  electronProcess = spawnChild(
    electron,
    ["."],
    {
      VITE_DEV_SERVER_URL: devServerUrl,
    }
  );

  electronProcess.on(
    "exit",
    code => {
      if (
        !restartingElectron &&
        !shuttingDown
      ) {
        shutdown(code ?? 0);
      }
    }
  );
}

/**
 * Reinicia Electron quando main/preload forem recompilados.
 */
function restartElectron() {
  if (
    !electronProcess ||
    electronProcess.killed ||
    electronProcess.exitCode !== null
  ) {
    startElectron();
    return;
  }

  console.log(
    "[dev] Reiniciando Electron..."
  );

  restartingElectron = true;

  electronProcess.once(
    "exit",
    () => {
      restartingElectron = false;

      if (!shuttingDown) {
        startElectron();
      }
    }
  );

  electronProcess.kill();
}

/**
 * Evita diversos restarts seguidos durante recompilação.
 */
function scheduleElectronRestart() {
  if (restartTimer) {
    clearTimeout(restartTimer);
  }

  restartTimer = setTimeout(
    () => {
      restartTimer = null;

      restartElectron();
    },
    350
  );
}

/**
 * Ctrl+C / encerramento.
 */
process.on(
  "SIGINT",
  () => shutdown(0)
);

process.on(
  "SIGTERM",
  () => shutdown(0)
);

/**
 * Evita fechar silenciosamente em erros async.
 */
process.on(
  "unhandledRejection",
  error => {
    console.error(
      "\n[dev] Erro não tratado:"
    );

    console.error(error);

    shutdown(1);
  }
);

process.on(
  "uncaughtException",
  error => {
    console.error(
      "\n[dev] Erro fatal:"
    );

    console.error(error);

    shutdown(1);
  }
);

console.log("");
console.log("===============================");
console.log(" NPSharp Development Environment");
console.log("===============================");
console.log(`Root: ${root}`);
console.log(`Platform: ${process.platform}`);
console.log(`Node: ${process.version}`);
console.log(`Vite: ${devServerUrl}`);
console.log("");

/**
 * Compilador Electron em modo watch.
 */
spawnChild(
  npm,
  [
    "run",
    "dev:electron",
  ]
);

/**
 * Vite / Renderer.
 */
spawnChild(
  npm,
  [
    "run",
    "dev:renderer",
  ],
  {
    VITE_PORT:
      String(devServerPort),

    VITE_DEV_SERVER_URL:
      devServerUrl,
  }
);

/**
 * Aguarda os builds do Electron.
 */
await waitForFile(mainFile);

await waitForFile(preloadFile);

/**
 * Aguarda o Vite.
 */
await waitForUrl(devServerUrl);

/**
 * Agora podemos abrir o Electron.
 */
startElectron();

/**
 * Reinicia o Electron automaticamente quando
 * o main ou preload forem recompilados.
 */
for (
  const file of watchedOutputFiles
) {
  watchFile(
    file,
    {
      interval: 500,
      persistent: true,
    },
    (current, previous) => {
      const changed =
        current.mtimeMs !== previous.mtimeMs ||
        current.size !== previous.size;

      if (changed) {
        scheduleElectronRestart();
      }
    }
  );
}