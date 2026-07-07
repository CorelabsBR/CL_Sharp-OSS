import { shell } from "electron";
import fs from "node:fs/promises";
import path from "node:path";
import type { FileReadResult, WorkspaceEntry } from "../../shared/types";

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
  const entries = await fs.readdir(targetPath, { withFileTypes: true });
  const result: WorkspaceEntry[] = [];

  for (const entry of entries) {
    if (entry.isDirectory() && IGNORED_DIRECTORY_NAMES.has(entry.name.toLowerCase())) {
      continue;
    }
    const fullPath = path.join(targetPath, entry.name);
    let stat;
    try {
      stat = await fs.stat(fullPath);
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
  const content = await fs.readFile(targetPath, "utf8");
  return {
    path: targetPath,
    name: path.basename(targetPath),
    content,
    lineEnding: content.includes("\r\n") ? "\r\n" : "\n",
    encoding: "utf8"
  };
}

export async function writeFile(targetPath: string, content: string): Promise<void> {
  await fs.mkdir(path.dirname(targetPath), { recursive: true });
  await fs.writeFile(targetPath, content ?? "", "utf8");
}

export async function createFile(targetPath: string): Promise<void> {
  await fs.mkdir(path.dirname(targetPath), { recursive: true });
  try {
    await fs.writeFile(targetPath, "", { flag: "wx" });
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "EEXIST") throw error;
  }
}

export async function createFolder(targetPath: string): Promise<void> {
  await fs.mkdir(targetPath, { recursive: true });
}

export async function renamePath(oldPath: string, newPath: string): Promise<void> {
  await fs.rename(oldPath, newPath);
}

export async function deletePath(targetPath: string): Promise<void> {
  await fs.rm(targetPath, { recursive: true, force: true });
}

export async function revealPath(targetPath: string): Promise<void> {
  await shell.showItemInFolder(targetPath);
}

export async function exists(targetPath: string): Promise<boolean> {
  try {
    await fs.access(targetPath);
    return true;
  } catch {
    return false;
  }
}
