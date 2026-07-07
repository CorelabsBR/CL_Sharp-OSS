import fs from "node:fs/promises";
import path from "node:path";
import type { ReplaceAllRequest, ReplaceAllResult, SearchQuery, SearchResult } from "../../shared/types";

const MAX_FILE_SIZE_BYTES = 5 * 1024 * 1024;
const MAX_RESULTS = 5000;
const MAX_SCANNED_FILES = 50000;
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
const BINARY_EXTENSIONS = new Set([
  ".class",
  ".jar",
  ".png",
  ".jpg",
  ".jpeg",
  ".gif",
  ".webp",
  ".ico",
  ".pdf",
  ".zip",
  ".tar",
  ".gz",
  ".7z",
  ".rar",
  ".mp3",
  ".mp4",
  ".wav",
  ".ogg",
  ".exe",
  ".dll",
  ".so",
  ".bin",
  ".ttf",
  ".woff",
  ".woff2"
]);

export async function searchWorkspace(query: SearchQuery): Promise<SearchResult[]> {
  const root = path.resolve(query.workspace);
  if (!query.text) {
    return [];
  }
  if (query.useRegex) {
    compileSearchPattern(query.text, query.caseSensitive, query.wholeWord);
  }

  const results: SearchResult[] = [];
  let scannedFiles = 0;

  await walk(root, query.includeHidden ?? false, async file => {
    if (results.length >= (query.limit ?? MAX_RESULTS) || scannedFiles >= MAX_SCANNED_FILES) {
      return false;
    }
    scannedFiles++;
    await searchFile(root, file, query, results);
    return results.length < (query.limit ?? MAX_RESULTS);
  });

  return results
    .sort((a, b) => b.score - a.score || a.relativePath.localeCompare(b.relativePath) || a.line - b.line || a.column - b.column)
    .slice(0, query.limit ?? MAX_RESULTS);
}

export async function replaceAll(request: ReplaceAllRequest): Promise<ReplaceAllResult> {
  if (!request.text) {
    return { changedFiles: 0, replacements: 0 };
  }
  if (request.useRegex) {
    compileSearchPattern(request.text, request.caseSensitive, request.wholeWord);
  }

  const root = path.resolve(request.workspace);
  let changedFiles = 0;
  let replacements = 0;

  await walk(root, request.includeHidden ?? false, async file => {
    try {
      const stat = await fs.stat(file);
      if (stat.size > MAX_FILE_SIZE_BYTES || !isSearchablePath(file)) return true;
      const content = await fs.readFile(file, "utf8");
      if (content.includes("\0") || !content.trim()) return true;
      const { updated, count } = replaceContent(content, request.text, request.replaceWith ?? "", request.caseSensitive, request.wholeWord, request.useRegex ?? false);
      if (count > 0 && updated !== content) {
        await fs.writeFile(file, updated, "utf8");
        changedFiles++;
        replacements += count;
      }
    } catch {
      // Java version ignores unreadable, binary, locked or badly encoded files.
    }
    return true;
  });

  return { changedFiles, replacements };
}

async function walk(root: string, includeHidden: boolean, onFile: (file: string) => Promise<boolean>): Promise<boolean> {
  let entries;
  try {
    entries = await fs.readdir(root, { withFileTypes: true });
  } catch {
    return true;
  }

  for (const entry of entries) {
    if (!includeHidden && entry.name.startsWith(".")) continue;
    const fullPath = path.join(root, entry.name);

    if (entry.isDirectory()) {
      if (IGNORED_DIRECTORY_NAMES.has(entry.name.toLowerCase())) continue;
      const shouldContinue = await walk(fullPath, includeHidden, onFile);
      if (!shouldContinue) return false;
    } else if (entry.isFile()) {
      const shouldContinue = await onFile(fullPath);
      if (!shouldContinue) return false;
    }
  }
  return true;
}

async function searchFile(root: string, file: string, query: SearchQuery, results: SearchResult[]): Promise<void> {
  try {
    const stat = await fs.stat(file);
    if (stat.size > MAX_FILE_SIZE_BYTES || !isSearchablePath(file)) {
      return;
    }

    const text = await fs.readFile(file, "utf8");
    if (text.includes("\0") || !text.trim()) {
      return;
    }

    if (query.useRegex) {
      const pattern = compileSearchPattern(query.text, query.caseSensitive, query.wholeWord);
      for (const match of text.matchAll(pattern)) {
        if (results.length >= (query.limit ?? MAX_RESULTS)) return;
        const start = match.index ?? 0;
        const matched = match[0] ?? "";
        const end = start + Math.max(matched.length, 1);
        addResult(root, file, text, start, end, matched || query.text, results);
        if (!matched) pattern.lastIndex++;
      }
      return;
    }

    if (query.wholeWord) {
      const pattern = new RegExp(`\\b${escapeRegExp(query.text)}\\b`, query.caseSensitive ? "g" : "gi");
      for (const match of text.matchAll(pattern)) {
        if (results.length >= (query.limit ?? MAX_RESULTS)) return;
        const start = match.index ?? 0;
        addResult(root, file, text, start, start + query.text.length, query.text, results);
      }
      return;
    }

    const haystack = query.caseSensitive ? text : text.toLowerCase();
    const needle = query.caseSensitive ? query.text : query.text.toLowerCase();
    let from = 0;
    while (true) {
      if (results.length >= (query.limit ?? MAX_RESULTS)) return;
      const index = haystack.indexOf(needle, from);
      if (index < 0) break;
      const end = index + query.text.length;
      addResult(root, file, text, index, end, query.text, results);
      from = Math.max(end, from + 1);
    }
  } catch {
    // Match Java behavior: ignore bad encoding, permission denied, binary and locked files.
  }
}

function replaceContent(source: string, search: string, replace: string, caseSensitive: boolean, wholeWord: boolean, useRegex: boolean): { updated: string; count: number } {
  if (useRegex) {
    const pattern = compileSearchPattern(search, caseSensitive, wholeWord);
    const matches = Array.from(source.matchAll(pattern)).length;
    return { updated: source.replace(pattern, replace), count: matches };
  }
  if (wholeWord) {
    const pattern = new RegExp(`\\b${escapeRegExp(search)}\\b`, caseSensitive ? "g" : "gi");
    const matches = Array.from(source.matchAll(pattern)).length;
    return { updated: source.replace(pattern, replace), count: matches };
  }
  if (caseSensitive) {
    const count = countOccurrences(source, search);
    return { updated: source.split(search).join(replace), count };
  }
  const pattern = new RegExp(escapeRegExp(search), "gi");
  const matches = Array.from(source.matchAll(pattern)).length;
  return { updated: source.replace(pattern, replace), count: matches };
}

function addResult(root: string, filePath: string, text: string, start: number, end: number, needle: string, results: SearchResult[]): void {
  const relativePath = path.relative(root, filePath);
  const preview = extractPreview(text, start, end);
  const line = getLineNumber(text, start);
  const column = getColumnNumber(text, start);
  results.push({
    filePath,
    relativePath,
    line,
    column,
    start,
    end,
    preview,
    score: scoreResult(path.basename(filePath), preview, needle)
  });
}

function isSearchablePath(file: string): boolean {
  const normalized = file.replace(/\\/g, "/").toLowerCase();
  if (
    normalized.includes("/.git/") ||
    normalized.includes("/node_modules/") ||
    normalized.includes("/target/") ||
    normalized.includes("/build/") ||
    normalized.includes("/dist/") ||
    normalized.includes("/out/") ||
    normalized.includes("/bin/") ||
    normalized.includes("/.idea/") ||
    normalized.includes("/.gradle/") ||
    normalized.includes("/.settings/") ||
    normalized.includes("/vendor/") ||
    normalized.includes("/coverage/")
  ) {
    return false;
  }
  return !BINARY_EXTENSIONS.has(path.extname(file).toLowerCase()) && path.basename(file).toLowerCase() !== ".ds_store";
}

function getLineNumber(text: string, offset: number): number {
  let line = 1;
  const max = Math.min(offset, text.length);
  for (let i = 0; i < max; i++) {
    if (text.charAt(i) === "\n") line++;
  }
  return line;
}

function getColumnNumber(text: string, offset: number): number {
  const max = Math.min(offset, text.length);
  let lastBreak = -1;
  for (let i = 0; i < max; i++) {
    if (text.charAt(i) === "\n") lastBreak = i;
  }
  return max - lastBreak;
}

function extractPreview(text: string, start: number, end: number): string {
  const previewStart = Math.max(0, start - 35);
  const previewEnd = Math.min(text.length, end + 60);
  return text.slice(previewStart, previewEnd).replace(/\r/g, " ").replace(/\n/g, " ").trim();
}

function scoreResult(fileName: string, preview: string, needle: string): number {
  let score = 0;
  const lowerPreview = preview.toLowerCase();
  const lowerNeedle = needle.toLowerCase();
  const lowerFile = fileName.toLowerCase();
  if (lowerPreview.startsWith(lowerNeedle)) score += 100;
  if (lowerPreview.includes(lowerNeedle)) score += 50;
  if (lowerFile.includes(lowerNeedle)) score += 200;
  if (lowerFile === lowerNeedle) score += 500;
  return score;
}

function countOccurrences(source: string, needle: string): number {
  let count = 0;
  let index = 0;
  while ((index = source.indexOf(needle, index)) !== -1) {
    count++;
    index += needle.length;
  }
  return count;
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function compileSearchPattern(search: string, caseSensitive: boolean, wholeWord: boolean): RegExp {
  const source = wholeWord ? `\\b(?:${search})\\b` : search;
  try {
    return new RegExp(source, caseSensitive ? "g" : "gi");
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(`Invalid search regex: ${message}`);
  }
}
