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
  const entries = await fsp.readdir(targetPath, { withFileTypes: true });
  const result: WorkspaceEntry[] = [];

  for (const entry of entries) {
    if (entry.isDirectory() && IGNORED_DIRECTORY_NAMES.has(entry.name.toLowerCase())) {
      continue;
    }
    const fullPath = path.join(targetPath, entry.name);
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
  const content = await fsp.readFile(targetPath, "utf8");
  return {
    path: targetPath,
    name: path.basename(targetPath),
    content,
    lineEnding: content.includes("\r\n") ? "\r\n" : "\n",
    encoding: "utf8"
  };
}

export async function writeFile(targetPath: string, content: string): Promise<void> {
  await fsp.mkdir(path.dirname(targetPath), { recursive: true });
  await fsp.writeFile(targetPath, content ?? "", "utf8");
}

export async function createFile(targetPath: string): Promise<void> {
  await fsp.mkdir(path.dirname(targetPath), { recursive: true });
  try {
    await fsp.writeFile(targetPath, "", { flag: "wx" });
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "EEXIST") throw error;
  }
}

export async function createFolder(targetPath: string): Promise<void> {
  await fsp.mkdir(targetPath, { recursive: true });
}

export async function renamePath(oldPath: string, newPath: string): Promise<void> {
  await fsp.rename(oldPath, newPath);
}

export async function deletePath(targetPath: string): Promise<void> {
  await fsp.rm(targetPath, { recursive: true, force: true });
}

export async function revealPath(targetPath: string): Promise<void> {
  await shell.showItemInFolder(targetPath);
}

export async function exists(targetPath: string): Promise<boolean> {
  try {
    await fsp.access(targetPath);
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
        const nextSnapshot = await snapshotWorkspace(rootPath);
        if (previousSnapshot && snapshotsDiffer(previousSnapshot, nextSnapshot)) {
          emit({ root: rootPath, eventType: "change", path: rootPath });
        }
        previousSnapshot = nextSnapshot;
      } catch (error) {
        onError(error);
        emit({ root: rootPath, eventType: "error", path: rootPath, error: errorMessage(error) });
      } finally {
        if (!disposed) pollTimer = setTimeout(poll, 2000);
      }
    };
    void poll();
  };

  try {
    nativeWatcher = fs.watch(rootPath, { recursive: true }, (eventType, filename) => {
      const eventPath = filename ? path.join(rootPath, filename.toString()) : rootPath;
      emit({ root: rootPath, eventType, path: eventPath });
    });
    nativeWatcher.on("error", error => {
      onError(error);
      emit({ root: rootPath, eventType: "error", path: rootPath, error: errorMessage(error) });
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
  };
}

function debounce<T extends unknown[]>(callback: (...args: T) => void, delayMs: number): (...args: T) => void {
  let timer: NodeJS.Timeout | undefined;
  return (...args: T) => {
    if (timer) clearTimeout(timer);
    timer = setTimeout(() => callback(...args), delayMs);
  };
}

async function snapshotWorkspace(rootPath: string, limit = 10000): Promise<Map<string, string>> {
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

  const rootStat = await fsp.stat(rootPath);
  snapshot.set(rootPath, `d:${rootStat.size}:${rootStat.mtimeMs}`);
  await walk(rootPath);
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
