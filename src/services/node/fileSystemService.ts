import { shell } from "electron";
import fs from "node:fs";
import fsp from "node:fs/promises";
import path from "node:path";
import { gunzipSync } from "node:zlib";
import type { FileOpenResult, FileReadResult, TextEncoding, WorkspaceChangeEvent, WorkspaceEntry } from "../../shared/types";

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
const MEDIA_EXTENSIONS = new Set([".mp3", ".wav", ".ogg", ".oga", ".m4a", ".aac", ".flac", ".mp4", ".webm", ".ogv", ".mov", ".mkv"]);
const ARCHIVE_EXTENSIONS = new Set([".zip", ".jar", ".war", ".ear", ".apk", ".vsix"]);
const NBT_EXTENSIONS = new Set([".nbt", ".schem", ".schematic"]);
const MAX_EMBEDDED_PREVIEW_BYTES = 32 * 1024 * 1024;
const MAX_BINARY_PREVIEW_BYTES = 512 * 1024;

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
  const decoded = decodeText(await fsp.readFile(filePath));
  return {
    path: filePath,
    name: path.basename(filePath),
    content: decoded.content,
    lineEnding: decoded.content.includes("\r\n") ? "\r\n" : "\n",
    encoding: decoded.encoding
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

  if (!forceText && extension === ".pdf") {
    return binaryPreview(filePath, buffer, type, "pdf", "PDF", extension);
  }

  if (!forceText && MEDIA_EXTENSIONS.has(extension)) {
    return binaryPreview(filePath, buffer, type, "media", "Mídia", extension);
  }

  if (!forceText && (NBT_EXTENSIONS.has(extension) || extension === ".dat")) {
    const nbt = tryParseNbt(buffer);
    if (nbt) {
      return {
        path: filePath,
        name: path.basename(filePath),
        editor: "nbt",
        size: buffer.byteLength,
        type: "NBT",
        content: nbt,
        previewSummary: "Estrutura NBT em modo somente leitura"
      };
    }
  }

  if (!forceText && ARCHIVE_EXTENSIONS.has(extension) && isZipArchive(buffer)) {
    return {
      path: filePath,
      name: path.basename(filePath),
      editor: "archive",
      size: buffer.byteLength,
      type: type || "Archive",
      content: inspectZip(buffer),
      previewSummary: "Conteúdo do arquivo compactado em modo somente leitura"
    };
  }

  const detectedBinary = isBinaryContent(buffer);
  if (!forceText && (BINARY_EXTENSIONS.has(extension) || detectedBinary)) {
    return binaryPreview(
      filePath,
      buffer,
      type,
      "binary",
      BINARY_EXTENSIONS.has(extension) ? "A extensão indica um formato binário." : "O conteúdo contém bytes que não representam texto legível.",
      extension
    );
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

function binaryPreview(filePath: string, buffer: Buffer, type: string, editor: "binary" | "media" | "pdf", summary: string, extension: string): FileOpenResult {
  const previewTruncated = buffer.byteLength > MAX_BINARY_PREVIEW_BYTES;
  const result: FileOpenResult = {
    path: filePath,
    name: path.basename(filePath),
    editor,
    size: buffer.byteLength,
    type,
    previewData: buffer.subarray(0, MAX_BINARY_PREVIEW_BYTES).toString("base64"),
    previewTruncated,
    previewSummary: summary,
    binaryReason: editor === "binary" ? summary : undefined
  };
  if (editor !== "binary" && buffer.byteLength <= MAX_EMBEDDED_PREVIEW_BYTES) {
    result.dataUrl = `data:${mimeTypeFor(extension)};base64,${buffer.toString("base64")}`;
  }
  return result;
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

function isZipArchive(buffer: Buffer): boolean {
  return buffer.length >= 4 && buffer[0] === 0x50 && buffer[1] === 0x4b && ([0x03, 0x05, 0x07].includes(buffer[2])) && ([0x04, 0x06, 0x08].includes(buffer[3]));
}

function inspectZip(buffer: Buffer): string {
  const signature = Buffer.from([0x50, 0x4b, 0x05, 0x06]);
  const offset = buffer.lastIndexOf(signature);
  if (offset < 0 || offset + 22 > buffer.length) return "Arquivo ZIP reconhecido, mas o índice central não pôde ser lido.";
  const entries = buffer.readUInt16LE(offset + 10);
  let cursor = buffer.readUInt32LE(offset + 16);
  const names: string[] = [];
  for (let index = 0; index < Math.min(entries, 1000); index++) {
    if (cursor + 46 > buffer.length || buffer.readUInt32LE(cursor) !== 0x02014b50) break;
    const nameLength = buffer.readUInt16LE(cursor + 28);
    const extraLength = buffer.readUInt16LE(cursor + 30);
    const commentLength = buffer.readUInt16LE(cursor + 32);
    names.push(buffer.subarray(cursor + 46, cursor + 46 + nameLength).toString("utf8"));
    cursor += 46 + nameLength + extraLength + commentLength;
  }
  const suffix = entries > names.length ? `\n… e mais ${entries - names.length} entradas.` : "";
  return `${entries} entrada(s)\n\n${names.join("\n")}${suffix}`;
}

function tryParseNbt(input: Buffer): string | undefined {
  try {
    const buffer = input.subarray(0, 2).equals(Buffer.from([0x1f, 0x8b])) ? gunzipSync(input) : input;
    if (buffer.byteLength > 32 * 1024 * 1024) return undefined;
    const reader = new NbtReader(buffer);
    const rootType = reader.byte();
    if (rootType !== 10) return undefined;
    const rootName = reader.string();
    const value = reader.payload(rootType, 0);
    if (!reader.finished()) return undefined;
    return JSON.stringify({ [rootName || "root"]: value }, nbtJsonReplacer, 2);
  } catch {
    return undefined;
  }
}

const nbtJsonReplacer = (_key: string, value: unknown): unknown => typeof value === "bigint" ? `${value}n` : value;

class NbtReader {
  private offset = 0;

  constructor(private readonly buffer: Buffer) {}

  finished(): boolean { return this.offset === this.buffer.length; }
  byte(): number { this.require(1); return this.buffer.readInt8(this.offset++); }
  unsignedByte(): number { this.require(1); return this.buffer[this.offset++]; }
  short(): number { this.require(2); const value = this.buffer.readInt16BE(this.offset); this.offset += 2; return value; }
  int(): number { this.require(4); const value = this.buffer.readInt32BE(this.offset); this.offset += 4; return value; }
  long(): bigint { this.require(8); const value = this.buffer.readBigInt64BE(this.offset); this.offset += 8; return value; }
  float(): number { this.require(4); const value = this.buffer.readFloatBE(this.offset); this.offset += 4; return value; }
  double(): number { this.require(8); const value = this.buffer.readDoubleBE(this.offset); this.offset += 8; return value; }
  string(): string { const length = this.unsignedShort(); this.require(length); const value = this.buffer.subarray(this.offset, this.offset + length).toString("utf8"); this.offset += length; return value; }

  payload(type: number, depth: number): unknown {
    if (depth > 64) throw new Error("NBT nesting limit");
    switch (type) {
      case 1: return this.byte();
      case 2: return this.short();
      case 3: return this.int();
      case 4: return this.long();
      case 5: return this.float();
      case 6: return this.double();
      case 7: return this.array(() => this.byte());
      case 8: return this.string();
      case 9: {
        const itemType = this.unsignedByte();
        const length = this.length();
        return Array.from({ length }, () => this.payload(itemType, depth + 1));
      }
      case 10: {
        const result: Record<string, unknown> = {};
        for (;;) {
          const itemType = this.unsignedByte();
          if (itemType === 0) return result;
          result[this.string()] = this.payload(itemType, depth + 1);
        }
      }
      case 11: return this.array(() => this.int());
      case 12: return this.array(() => this.long());
      default: throw new Error("Unknown NBT tag");
    }
  }

  private unsignedShort(): number { this.require(2); const value = this.buffer.readUInt16BE(this.offset); this.offset += 2; return value; }
  private length(): number { const value = this.int(); if (value < 0 || value > 1_000_000) throw new Error("Invalid NBT length"); return value; }
  private array<T>(read: () => T): T[] { const length = this.length(); return Array.from({ length }, read); }
  private require(length: number): void { if (this.offset + length > this.buffer.length) throw new Error("Unexpected end of NBT"); }
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

function decodeText(buffer: Buffer): { content: string; encoding: TextEncoding } {
  if (buffer.subarray(0, 3).equals(Buffer.from([0xef, 0xbb, 0xbf]))) {
    return { content: buffer.subarray(3).toString("utf8"), encoding: "utf8bom" };
  }
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
  return ({
    ".png": "image/png", ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".gif": "image/gif", ".bmp": "image/bmp", ".webp": "image/webp", ".svg": "image/svg+xml", ".ico": "image/x-icon", ".tiff": "image/tiff", ".tif": "image/tiff", ".avif": "image/avif",
    ".pdf": "application/pdf", ".mp3": "audio/mpeg", ".wav": "audio/wav", ".ogg": "audio/ogg", ".oga": "audio/ogg", ".m4a": "audio/mp4", ".aac": "audio/aac", ".flac": "audio/flac",
    ".mp4": "video/mp4", ".webm": "video/webm", ".ogv": "video/ogg", ".mov": "video/quicktime", ".mkv": "video/x-matroska"
  } as Record<string, string>)[extension] ?? "application/octet-stream";
}

export async function writeFile(targetPath: string, content: string, encoding: TextEncoding = "utf8"): Promise<void> {
  const filePath = normalizeFsPath(targetPath);
  await fsp.mkdir(path.dirname(filePath), { recursive: true });
  await fsp.writeFile(filePath, encodeText(content ?? "", encoding));
}

function encodeText(content: string, encoding: TextEncoding): Buffer {
  switch (encoding) {
    case "utf8bom":
      return Buffer.concat([Buffer.from([0xef, 0xbb, 0xbf]), Buffer.from(content, "utf8")]);
    case "utf16le":
      return Buffer.concat([Buffer.from([0xff, 0xfe]), Buffer.from(content, "utf16le")]);
    case "utf16be": {
      const littleEndian = Buffer.from(content, "utf16le");
      for (let index = 0; index < littleEndian.length; index += 2) {
        const first = littleEndian[index];
        littleEndian[index] = littleEndian[index + 1];
        littleEndian[index + 1] = first;
      }
      return Buffer.concat([Buffer.from([0xfe, 0xff]), littleEndian]);
    }
    case "latin1":
    case "windows-1252":
      return Buffer.from(content, "latin1");
    case "utf8":
    default:
      return Buffer.from(content, "utf8");
  }
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

/** Creates a workspace file atomically, without changing the legacy createFile behavior. */
export async function createNewFile(targetPath: string, initialContent = ""): Promise<void> {
  const filePath = normalizeFsPath(targetPath);
  await fsp.mkdir(path.dirname(filePath), { recursive: true });
  await fsp.writeFile(filePath, initialContent, { encoding: "utf8", flag: "wx" });
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
  let polling = false;

  const emit = debounce((event: WorkspaceChangeEvent) => {
    if (!disposed) onChange(event);
  }, 250);

  const startPolling = (): void => {
    if (polling || disposed) return;
    polling = true;
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
    // Linux recursive fs.watch can allocate one inotify descriptor per directory.
    // Keep a single shallow watcher and use the bounded snapshot for nested changes.
    const recursive = process.platform !== "linux";
    nativeWatcher = fs.watch(root, { recursive }, (eventType, filename) => {
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
      startPolling();
    });
    if (!recursive) startPolling();
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
