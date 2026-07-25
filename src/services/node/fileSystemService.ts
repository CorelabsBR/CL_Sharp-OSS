import { shell } from "electron";
import fs from "node:fs";
import fsp from "node:fs/promises";
import path from "node:path";
import type { FileOpenResult, FileReadResult, WorkspaceChangeEvent, WorkspaceEntry } from "../../shared/types";

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

const IMAGE_EXTENSIONS = new Set([".png", ".jpg", ".jpeg", ".gif", ".bmp", ".webp", ".svg", ".ico", ".tiff", ".tif", ".avif"]);
const BINARY_EXTENSIONS = new Set([".exe", ".dll", ".so", ".dylib", ".bin", ".dat", ".elf", ".class", ".jar", ".war", ".ear", ".apk", ".ipa", ".dex", ".o", ".obj", ".a", ".lib", ".wasm", ".pyc", ".pyd"]);

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

/** Resolves the editor from both the file signature/content and its extension. */
export async function openFile(targetPath: string, forceText = false): Promise<FileOpenResult> {
  const filePath = normalizeFsPath(targetPath);
  const buffer = await fsp.readFile(filePath);
  const extension = path.extname(filePath).toLowerCase();
  const type = extension ? extension.slice(1).toUpperCase() : "Arquivo";

  if (!forceText && IMAGE_EXTENSIONS.has(extension) && isImageContent(extension, buffer)) {
    return {
      path: filePath,
      name: path.basename(filePath),
      editor: "image",
      size: buffer.byteLength,
      type,
      imageDataUrl: `data:${mimeTypeFor(extension)};base64,${buffer.toString("base64")}`
    };
  }

  const detectedBinary = isBinaryContent(buffer);
  if (!forceText && (BINARY_EXTENSIONS.has(extension) || detectedBinary)) {
    return {
      path: filePath,
      name: path.basename(filePath),
      editor: "binary",
      size: buffer.byteLength,
      type,
      binaryReason: BINARY_EXTENSIONS.has(extension)
        ? "A extensao indica um formato binario."
        : "O conteudo contem bytes que nao representam texto legivel."
    };
  }

  const decoded = decodeText(buffer);
  return {
    path: filePath,
    name: path.basename(filePath),
    editor: "text",
    size: buffer.byteLength,
    type,
    content: decoded.content,
    lineEnding: decoded.content.includes("\r\n") ? "\r\n" : "\n",
    encoding: decoded.encoding
  };
}

function isImageContent(extension: string, buffer: Buffer): boolean {
  const startsWith = (...bytes: number[]) => bytes.every((byte, index) => buffer[index] === byte);
  switch (extension) {
    case ".png": return startsWith(0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a);
    case ".jpg": case ".jpeg": return startsWith(0xff, 0xd8, 0xff);
    case ".gif": return buffer.subarray(0, 6).toString("ascii") === "GIF87a" || buffer.subarray(0, 6).toString("ascii") === "GIF89a";
    case ".bmp": return startsWith(0x42, 0x4d);
    case ".webp": return buffer.subarray(0, 4).toString("ascii") === "RIFF" && buffer.subarray(8, 12).toString("ascii") === "WEBP";
    case ".ico": return startsWith(0, 0, 1, 0);
    case ".tif": case ".tiff": return startsWith(0x49, 0x49, 0x2a, 0) || startsWith(0x4d, 0x4d, 0, 0x2a);
    case ".avif": return buffer.subarray(4, 8).toString("ascii") === "ftyp" && buffer.subarray(8, 12).toString("ascii").includes("avif");
    case ".svg": return /<svg[\s>]/i.test(buffer.subarray(0, 4096).toString("utf8"));
    default: return false;
  }
}

function isBinaryContent(buffer: Buffer): boolean {
  if (buffer.length === 0) return false;
  if (buffer.length >= 2 && ((buffer[0] === 0xff && buffer[1] === 0xfe) || (buffer[0] === 0xfe && buffer[1] === 0xff))) return false;
  const sample = buffer.subarray(0, Math.min(buffer.length, 8192));
  const nulCount = sample.reduce((count, byte) => count + (byte === 0 ? 1 : 0), 0);
  if (nulCount > sample.length * 0.25) return true;
  let controls = 0;
  for (const byte of sample) {
    if (byte < 7 || (byte > 13 && byte < 32)) controls++;
  }
  return controls / sample.length > 0.1;
}

function decodeText(buffer: Buffer): { content: string; encoding: "utf8" | "utf16le" | "utf16be" | "latin1" | "windows-1252" } {
  const utf8 = buffer.toString("utf8");
  if (!utf8.includes("\uFFFD")) return { content: utf8, encoding: "utf8" };
  if (buffer.length >= 2 && buffer[0] === 0xff && buffer[1] === 0xfe) return { content: buffer.subarray(2).toString("utf16le"), encoding: "utf16le" };
  if (buffer.length >= 2 && buffer[0] === 0xfe && buffer[1] === 0xff) {
    const swapped = Buffer.allocUnsafe(buffer.length - 2);
    for (let index = 2; index + 1 < buffer.length; index += 2) {
      swapped[index - 2] = buffer[index + 1];
      swapped[index - 1] = buffer[index];
    }
    return { content: swapped.toString("utf16le"), encoding: "utf16be" };
  }
  return { content: buffer.toString("latin1"), encoding: "latin1" };
}

function mimeTypeFor(extension: string): string {
  return ({ ".png": "image/png", ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".gif": "image/gif", ".bmp": "image/bmp", ".webp": "image/webp", ".svg": "image/svg+xml", ".ico": "image/x-icon", ".tiff": "image/tiff", ".tif": "image/tiff", ".avif": "image/avif" } as Record<string, string>)[extension] ?? "application/octet-stream";
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
