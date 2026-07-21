import { shell } from "electron";
import fs from "node:fs";
import fsp from "node:fs/promises";
import path from "node:path";
import type { FileReadResult, WorkspaceChangeEvent, WorkspaceEntry } from "../../shared/types";

const IGNORED_DIRECTORY_NAMES = new Set([
  ".git",
  ".hg",
  ".svn",
  ".idea",
  ".gradle",
  ".settings",
  "node_modules",
  "target",
  "build",
  "dist",
  "out",
  "bin",
  "obj",
  "vendor",
  "coverage"
]);

export async function listDir(targetPath: string): Promise<WorkspaceEntry[]> {
  const directoryPath = normalizeFsPath(targetPath);
  const entries = await fsp.readdir(directoryPath, { withFileTypes: true });
  const result: WorkspaceEntry[] = [];

  for (const entry of entries) {
    if (entry.isDirectory() && IGNORED_DIRECTORY_NAMES.has(entry.name.toLowerCase())) {
      continue;
    }
    const fullPath = path.join(directoryPath, entry.name);
    let stat;
    try {
      stat = await fsp.stat(fullPath);
    } catch {
      continue;
    }
    result.push({
      path: fullPath,
      name: entry.name,
      directory: entry.isDirectory(),
      size: entry.isDirectory() ? 0 : stat.size,
      modifiedAt: stat.mtimeMs,
      hidden: entry.name.startsWith(".")
    });
  }

  return result.sort((a, b) => {
    if (a.directory !== b.directory) return a.directory ? -1 : 1;
    return a.name.localeCompare(b.name, undefined, { sensitivity: "base" });
  });
}

export async function readFile(targetPath: string): Promise<FileReadResult> {
  const filePath = normalizeFsPath(targetPath);
  const content = await fsp.readFile(filePath, "utf8");
  return {
    path: filePath,
    name: path.basename(filePath),
    content,
    lineEnding: content.includes("\r\n") ? "\r\n" : "\n",
    encoding: "utf8"
  };
}

export async function writeFile(targetPath: string, content: string): Promise<void> {
  const filePath = normalizeFsPath(targetPath);
  await fsp.mkdir(path.dirname(filePath), { recursive: true });
  await fsp.writeFile(filePath, content ?? "", "utf8");
}

export async function createFile(targetPath: string): Promise<void> {
  const filePath = normalizeFsPath(targetPath);
  await fsp.mkdir(path.dirname(filePath), { recursive: true });
  try {
    await fsp.writeFile(filePath, "", { flag: "wx" });
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "EEXIST") throw error;
  }
}

export async function createFolder(targetPath: string): Promise<void> {
  await fsp.mkdir(normalizeFsPath(targetPath), { recursive: true });
}

export async function renamePath(oldPath: string, newPath: string): Promise<void> {
  const from = normalizeFsPath(oldPath);
  const to = normalizeFsPath(newPath);
  await fsp.mkdir(path.dirname(to), { recursive: true });
  await fsp.rename(from, to);
}

export async function deletePath(targetPath: string): Promise<void> {
  await fsp.rm(normalizeFsPath(targetPath), { recursive: true, force: true });
}

export async function revealPath(targetPath: string): Promise<void> {
  shell.showItemInFolder(normalizeFsPath(targetPath));
}

export async function exists(targetPath: string): Promise<boolean> {
  try {
    await fsp.access(normalizeFsPath(targetPath));
    return true;
  } catch {
    return false;
  }
}

export function watchWorkspace(
  rootPath: string,
  onChange: (event: WorkspaceChangeEvent) => void,
  onError: (error: unknown) => void
): () => void {
  const root = normalizeFsPath(rootPath);
  let disposed = false;
  let pollTimer: NodeJS.Timeout | undefined;
  let nativeWatcher: fs.FSWatcher | undefined;
  let previousSnapshot: Map<string, string> | undefined;

  const emit = debounce((event: WorkspaceChangeEvent) => {
    if (!disposed) onChange(event);
  }, 250);

  const startPolling = (): void => {
    const poll = async (): Promise<void> => {
      if (disposed) return;
      try {
        const nextSnapshot = await snapshotWorkspace(root);
        if (disposed) return;
        if (previousSnapshot && snapshotsDiffer(previousSnapshot, nextSnapshot)) {
          emit.run({ root, eventType: "change", path: root });
        }
        previousSnapshot = nextSnapshot;
      } catch (error) {
        if (disposed) return;
        onError(error);
        emit.run({ root, eventType: "error", path: root, error: errorMessage(error) });
      } finally {
        if (!disposed) pollTimer = setTimeout(poll, 2000);
      }
    };
    void poll();
  };

  try {
    nativeWatcher = fs.watch(root, { recursive: true }, (eventType, filename) => {
      if (disposed) return;
      const eventPath = filename ? path.join(root, filename.toString()) : root;
      emit.run({ root, eventType, path: eventPath });
    });
    nativeWatcher.on("error", error => {
      if (disposed) return;
      onError(error);
      emit.run({ root, eventType: "error", path: root, error: errorMessage(error) });
      nativeWatcher?.close();
      nativeWatcher = undefined;
      if (!pollTimer) startPolling();
    });
  } catch (error) {
    onError(error);
    startPolling();
  }

  return () => {
    disposed = true;
    nativeWatcher?.close();
    if (pollTimer) clearTimeout(pollTimer);
    pollTimer = undefined;
    emit.cancel();
  };
}

interface DebouncedCallback<T extends unknown[]> {
  run(...args: T): void;
  cancel(): void;
}

function debounce<T extends unknown[]>(callback: (...args: T) => void, delayMs: number): DebouncedCallback<T> {
  let timer: NodeJS.Timeout | undefined;
  return {
    run(...args: T) {
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => {
        timer = undefined;
        callback(...args);
      }, delayMs);
    },
    cancel() {
      if (timer) clearTimeout(timer);
      timer = undefined;
    }
  };
}

async function snapshotWorkspace(rootPath: string, limit = 10000): Promise<Map<string, string>> {
  const root = normalizeFsPath(rootPath);
  const snapshot = new Map<string, string>();

  async function walk(dir: string): Promise<void> {
    if (snapshot.size >= limit) return;
    const entries = await fsp.readdir(dir, { withFileTypes: true });
    for (const entry of entries) {
      if (entry.isDirectory() && IGNORED_DIRECTORY_NAMES.has(entry.name.toLowerCase())) continue;
      const fullPath = path.join(dir, entry.name);
      let stat;
      try {
        stat = await fsp.stat(fullPath);
      } catch {
        continue;
      }
      snapshot.set(fullPath, `${entry.isDirectory() ? "d" : "f"}:${stat.size}:${stat.mtimeMs}`);
      if (entry.isDirectory()) await walk(fullPath);
      if (snapshot.size >= limit) return;
    }
  }

  const rootStat = await fsp.stat(root);
  snapshot.set(root, `d:${rootStat.size}:${rootStat.mtimeMs}`);
  await walk(root);
  return snapshot;
}

function snapshotsDiffer(left: Map<string, string>, right: Map<string, string>): boolean {
  if (left.size !== right.size) return true;
  for (const [key, value] of left) {
    if (right.get(key) !== value) return true;
  }
  return false;
}

function errorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  if (typeof error === "string") return error;
  return JSON.stringify(error);
}

function normalizeFsPath(targetPath: string): string {
  if (!targetPath?.trim()) {
    throw new Error("Caminho invalido.");
  }
  return path.resolve(path.normalize(targetPath));
}
