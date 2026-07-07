export function basename(filePath: string): string {
  const normalized = filePath.replace(/\\/g, "/");
  return normalized.slice(normalized.lastIndexOf("/") + 1) || normalized;
}

export function dirname(filePath: string): string {
  const normalized = filePath.replace(/\\/g, "/");
  const index = normalized.lastIndexOf("/");
  if (index <= 0) {
    return index === 0 ? "/" : "";
  }
  return normalized.slice(0, index);
}

export function extname(filePath: string): string {
  const name = basename(filePath);
  const index = name.lastIndexOf(".");
  return index <= 0 ? "" : name.slice(index).toLowerCase();
}

export function joinPath(...parts: string[]): string {
  const first = parts[0] ?? "";
  const separator = first.includes("\\") ? "\\" : "/";
  const joined = parts
    .filter(Boolean)
    .join(separator)
    .replace(/[\\/]+/g, separator);
  if (/^[A-Za-z]:/.test(first)) {
    return joined;
  }
  return first.startsWith("/") ? `/${joined.replace(/^\/+/, "")}` : joined;
}

export function relativePath(root: string, target: string): string {
  const rootParts = root.replace(/\\/g, "/").split("/").filter(Boolean);
  const targetParts = target.replace(/\\/g, "/").split("/").filter(Boolean);
  while (rootParts.length && targetParts.length && rootParts[0].toLowerCase() === targetParts[0].toLowerCase()) {
    rootParts.shift();
    targetParts.shift();
  }
  return targetParts.join("/");
}

export function fileUri(filePath: string): string {
  const normalized = filePath.replace(/\\/g, "/");
  const encoded = encodeURI(normalized).replace(/#/g, "%23").replace(/\?/g, "%3F");
  if (/^[A-Za-z]:\//.test(normalized)) {
    return `file:///${encoded}`;
  }
  return `file://${encoded}`;
}

export function isSubPath(root: string, target: string): boolean {
  const normalizedRoot = stripTrailingSlash(root.replace(/\\/g, "/").toLowerCase());
  const normalizedTarget = stripTrailingSlash(target.replace(/\\/g, "/").toLowerCase());
  return normalizedTarget === normalizedRoot || normalizedTarget.startsWith(`${normalizedRoot}/`);
}

function stripTrailingSlash(value: string): string {
  return value.length > 1 ? value.replace(/\/+$/, "") : value;
}
