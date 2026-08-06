/*---------------------------------------------------------------------------------------------
- Copyright (c) CorelabsBR. All rights reserved.
- Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
interface NativePathBridge {
  readonly sep: string;
  readonly delimiter: string;
  basename(filePath: string): string;
  dirname(filePath: string): string;
  extname(filePath: string): string;
  join(...parts: string[]): string;
  normalize(filePath: string): string;
  parse(filePath: string): { root: string; dir: string; base: string; ext: string; name: string };
  relative(from: string, to: string): string;
  resolve(...parts: string[]): string;
  isAbsolute(filePath: string): boolean;
  isSubPath(root: string, target: string): boolean;
  fileUri(filePath: string): string;
}

type WindowWithPathBridge = typeof window & {
  npsharpPath?: NativePathBridge;
};

export function basename(filePath: string): string {
  if (isRemoteUri(filePath)) return remoteParts(filePath).pathname.split("/").filter(Boolean).at(-1) ?? remoteParts(filePath).host;
  const native = nativePath();
  if (native) {
    const normalized = native.normalize(filePath);
    return native.basename(normalized) || native.parse(normalized).root || normalized;
  }
  const normalized = normalizePortable(filePath);
  return normalized.slice(normalized.lastIndexOf("/") + 1) || normalized;
}

export function dirname(filePath: string): string {
  if (isRemoteUri(filePath)) { const value = remoteParts(filePath); const parent = value.pathname.replace(/\/+$/, "").replace(/\/[^/]*$/, "") || "/"; return `npsharp-remote://${value.host}${parent}`; }
  const native = nativePath();
  if (native) return native.dirname(filePath);
  const normalized = normalizePortable(filePath);
  const index = normalized.lastIndexOf("/");
  if (index <= 0) {
    return index === 0 ? "/" : "";
  }
  return normalized.slice(0, index);
}

export function extname(filePath: string): string {
  if (isRemoteUri(filePath)) { const name = basename(filePath); const index = name.lastIndexOf("."); return index <= 0 ? "" : name.slice(index).toLowerCase(); }
  const native = nativePath();
  if (native) return native.extname(filePath).toLowerCase();
  const name = basename(filePath);
  const index = name.lastIndexOf(".");
  return index <= 0 ? "" : name.slice(index).toLowerCase();
}

export function joinPath(...parts: string[]): string {
  if (isRemoteUri(parts[0] ?? "")) return `${(parts[0] ?? "").replace(/\/+$/, "")}/${parts.slice(1).map(part => part.replace(/^\/+|\/+$/g, "")).filter(Boolean).join("/")}`;
  const native = nativePath();
  if (native) return native.normalize(native.join(...parts));
  return joinPortable(...parts);
}

export function relativePath(root: string, target: string): string {
  if (isRemoteUri(root) && isRemoteUri(target)) return remoteParts(target).pathname.slice(remoteParts(root).pathname.replace(/\/+$/, "").length).replace(/^\/+/, "");
  const native = nativePath();
  if (native) return native.relative(root, target);
  const rootParts = normalizePortable(root).split("/").filter(Boolean);
  const targetParts = normalizePortable(target).split("/").filter(Boolean);
  while (rootParts.length && targetParts.length && rootParts[0].toLowerCase() === targetParts[0].toLowerCase()) {
    rootParts.shift();
    targetParts.shift();
  }
  return targetParts.join("/");
}

export function fileUri(filePath: string): string {
  const native = nativePath();
  if (native) return native.fileUri(filePath);
  const normalized = normalizePortable(filePath);
  const encoded = encodeURI(normalized).replace(/#/g, "%23").replace(/\?/g, "%3F");
  if (/^[A-Za-z]:\//.test(normalized)) {
    return `file:///${encoded}`;
  }
  return `file://${encoded}`;
}

export function isSubPath(root: string, target: string): boolean {
  if (isRemoteUri(root) || isRemoteUri(target)) { if (!isRemoteUri(root) || !isRemoteUri(target)) return false; const a = remoteParts(root), b = remoteParts(target); const base = a.pathname.replace(/\/+$/, ""); return a.host === b.host && (b.pathname === base || b.pathname.startsWith(`${base}/`)); }
  const native = nativePath();
  if (native) return native.isSubPath(root, target);
  const normalizedRoot = stripTrailingSlash(normalizePortable(root).toLowerCase());
  const normalizedTarget = stripTrailingSlash(normalizePortable(target).toLowerCase());
  return normalizedTarget === normalizedRoot || normalizedTarget.startsWith(`${normalizedRoot}/`);
}

export function normalizePath(filePath: string): string {
  if (isRemoteUri(filePath)) { const value = remoteParts(filePath); return `npsharp-remote://${value.host}${value.pathname.replace(/\/+/g, "/").replace(/\/$/, "") || "/"}`; }
  const native = nativePath();
  if (native) return native.normalize(filePath);
  return normalizePortable(filePath);
}

export function resolvePath(...parts: string[]): string {
  const native = nativePath();
  if (native) return native.resolve(...parts);
  return joinPortable(...parts);
}

export function samePath(left: string, right: string): boolean {
  if (isRemoteUri(left) || isRemoteUri(right)) return normalizePath(left) === normalizePath(right);
  const native = nativePath();
  if (native) {
    const normalizedLeft = native.resolve(left);
    const normalizedRight = native.resolve(right);
    return pathComparisonKey(normalizedLeft) === pathComparisonKey(normalizedRight);
  }
  return normalizePortable(left).toLowerCase() === normalizePortable(right).toLowerCase();
}

export function isAbsolutePath(filePath: string): boolean {
  if (isRemoteUri(filePath)) return true;
  const native = nativePath();
  if (native) return native.isAbsolute(filePath);
  return filePath.startsWith("/") || /^[A-Za-z]:[\\/]/.test(filePath);
}

export function pathSeparator(): string {
  return nativePath()?.sep ?? "/";
}

function stripTrailingSlash(value: string): string {
  return value.length > 1 ? value.replace(/\/+$/, "") : value;
}

function isRemoteUri(value: string): boolean { return value.startsWith("npsharp-remote://"); }
function remoteParts(value: string): { host: string; pathname: string } { const parsed = new URL(value); return { host: parsed.host, pathname: decodeURIComponent(parsed.pathname) }; }

function nativePath(): NativePathBridge | undefined {
  if (typeof window === "undefined") return undefined;
  return (window as WindowWithPathBridge).npsharpPath;
}

function normalizePortable(filePath: string): string {
  return filePath.replace(/\\/g, "/").replace(/\/+/g, "/");
}

function joinPortable(...parts: string[]): string {
  const first = parts[0] ?? "";
  const joined = parts
    .filter(Boolean)
    .join("/")
    .replace(/\/+/g, "/");
  if (/^[A-Za-z]:/.test(first)) {
    return joined;
  }
  return first.startsWith("/") ? `/${joined.replace(/^\/+/, "")}` : joined;
}

function pathComparisonKey(filePath: string): string {
  return /^[A-Za-z]:/.test(filePath) || filePath.includes("\\") ? filePath.toLowerCase() : filePath;
}
