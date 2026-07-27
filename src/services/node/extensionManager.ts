import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import extract from "extract-zip";
import type { ExtensionManifest, ExtensionRegistry, ExtensionRegistryEntry, InstalledExtension, OpenVsxExtension } from "../../shared/types";

const OPEN_VSX_ORIGIN = "https://open-vsx.org";
const OPEN_VSX_MAX_DOWNLOAD_BYTES = 100 * 1024 * 1024;

interface ExtensionPackageJson {
  name: string;
  publisher: string;
  version: string;
  displayName?: string;
  description?: string;
  icon?: string;
  categories?: string[];
}

export interface ExtensionActivationContext {
  readonly extensionPath: string;
  readonly extension: InstalledExtension;
}

export class ExtensionManager {
  private readonly extensionsDir: string;
  private readonly registryPath: string;

  constructor(private readonly userDataPath: string) {
    this.extensionsDir = path.join(userDataPath, "extensions");
    this.registryPath = path.join(userDataPath, "extensions.json");
  }

  async listInstalled(): Promise<InstalledExtension[]> {
    return this.scanInstalledExtensions();
  }

  async installVsix(vsixPath: string): Promise<InstalledExtension> {
    const source = path.resolve(path.normalize(vsixPath));
    if (!source.toLowerCase().endsWith(".vsix")) {
      throw new Error("Selecione um arquivo .vsix valido.");
    }
    await fs.access(source);
    await fs.mkdir(this.extensionsDir, { recursive: true });

    const tempRoot = await fs.mkdtemp(path.join(os.tmpdir(), "npsharp-vsix-"));
    let installTemp: string | undefined;
    try {
      await extract(source, { dir: tempRoot });
      const packageRoot = await this.findPackageRoot(tempRoot);
      const manifest = await this.readManifest(packageRoot);
      const target = path.join(this.extensionsDir, sanitizeExtensionFolder(manifest.id));
      installTemp = `${target}.install-${Date.now()}`;

      await fs.rm(installTemp, { recursive: true, force: true });
      await fs.cp(packageRoot, installTemp, { recursive: true });
      await this.copyVsixManifest(tempRoot, installTemp);
      await fs.rm(target, { recursive: true, force: true });
      await fs.rename(installTemp, target);
      installTemp = undefined;

      const installed = await this.readInstalledExtension(target, true);
      await this.upsertRegistry(installed);
      console.info(`[NPSharp extensions] Installed ${installed.id} ${installed.version}`);
      return installed;
    } finally {
      if (installTemp) await fs.rm(installTemp, { recursive: true, force: true }).catch(() => undefined);
      await fs.rm(tempRoot, { recursive: true, force: true }).catch(() => undefined);
    }
  }

  async searchOpenVsx(query: string): Promise<OpenVsxExtension[]> {
    const text = query.trim();
    if (!text) return [];
    const url = new URL("/api/-/search", OPEN_VSX_ORIGIN);
    url.searchParams.set("query", text);
    url.searchParams.set("size", "30");
    const response = await fetch(url, { headers: { Accept: "application/json" } });
    if (!response.ok) throw new Error(`Open VSX respondeu com ${response.status}.`);
    const payload = await response.json() as { extensions?: unknown };
    if (!Array.isArray(payload.extensions)) return [];
    return payload.extensions.map(parseOpenVsxExtension).filter((item): item is OpenVsxExtension => Boolean(item));
  }

  async installOpenVsx(extension: OpenVsxExtension): Promise<InstalledExtension> {
    const namespace = validateOpenVsxPart(extension.namespace, "namespace");
    const name = validateOpenVsxPart(extension.name, "nome");
    const version = validateOpenVsxPart(extension.version, "versão");
    const file = `${namespace}.${name}-${version}.vsix`;
    const url = new URL(`/api/${encodeURIComponent(namespace)}/${encodeURIComponent(name)}/${encodeURIComponent(version)}/file/${encodeURIComponent(file)}`, OPEN_VSX_ORIGIN);
    const response = await fetch(url, { redirect: "follow" });
    if (!response.ok) throw new Error(`Não foi possível baixar a extensão da Open VSX (${response.status}).`);
    const length = Number(response.headers.get("content-length") ?? "0");
    if (Number.isFinite(length) && length > OPEN_VSX_MAX_DOWNLOAD_BYTES) throw new Error("A extensão excede o limite de 100 MB.");
    const content = Buffer.from(await response.arrayBuffer());
    if (content.length > OPEN_VSX_MAX_DOWNLOAD_BYTES) throw new Error("A extensão excede o limite de 100 MB.");
    const tempRoot = await fs.mkdtemp(path.join(os.tmpdir(), "npsharp-openvsx-"));
    const vsixPath = path.join(tempRoot, file);
    try {
      await fs.writeFile(vsixPath, content, { flag: "wx" });
      return await this.installVsix(vsixPath);
    } finally {
      await fs.rm(tempRoot, { recursive: true, force: true }).catch(() => undefined);
    }
  }

  async enable(id: string): Promise<InstalledExtension[]> {
    await this.setEnabled(id, true);
    return this.scanInstalledExtensions();
  }

  async disable(id: string): Promise<InstalledExtension[]> {
    await this.setEnabled(id, false);
    return this.scanInstalledExtensions();
  }

  async uninstall(id: string): Promise<InstalledExtension[]> {
    const registry = await this.loadRegistry();
    const entry = registry.installed.find(item => sameExtensionId(item.id, id));
    if (!entry) return this.scanInstalledExtensions();
    if (!this.isManagedExtensionPath(entry.path)) {
      throw new Error(`Caminho de extensao invalido: ${entry.path}`);
    }

    await fs.rm(entry.path, { recursive: true, force: true });
    registry.installed = registry.installed.filter(item => !sameExtensionId(item.id, id));
    await this.saveRegistry(registry);
    console.info(`[NPSharp extensions] Uninstalled ${id}`);
    return this.scanInstalledExtensions();
  }

  async reload(id?: string): Promise<InstalledExtension[]> {
    const installed = await this.scanInstalledExtensions();
    if (id && !installed.some(item => sameExtensionId(item.id, id))) {
      throw new Error(`Extensao nao encontrada: ${id}`);
    }
    console.info(id ? `[NPSharp extensions] Reloaded ${id}` : "[NPSharp extensions] Reloaded installed extensions");
    return installed;
  }

  async activate(_context: ExtensionActivationContext): Promise<void> {
    throw new Error("Extension activation is not implemented yet.");
  }

  private async scanInstalledExtensions(): Promise<InstalledExtension[]> {
    await fs.mkdir(this.extensionsDir, { recursive: true });
    const registry = await this.loadRegistry();
    const enabledById = new Map(registry.installed.map(entry => [entry.id.toLowerCase(), entry.enabled]));
    const pathsById = new Map(registry.installed.map(entry => [entry.id.toLowerCase(), entry.path]));
    const discovered = await this.discoverExtensionFolders();
    const installed: InstalledExtension[] = [];

    for (const extensionPath of [...new Set([...registry.installed.map(entry => entry.path).filter(item => this.isManagedExtensionPath(item)), ...discovered])]) {
      try {
        const extension = await this.readInstalledExtension(extensionPath, true);
        extension.enabled = enabledById.get(extension.id.toLowerCase()) ?? extension.enabled;
        installed.push(extension);
        pathsById.set(extension.id.toLowerCase(), extension.path);
      } catch (error) {
        console.warn(`[NPSharp extensions] Ignoring invalid extension at ${extensionPath}.`, error);
      }
    }

    installed.sort((left, right) => left.displayName.localeCompare(right.displayName));
    await this.saveRegistry({
      installed: installed.map(extension => ({
        id: extension.id,
        enabled: extension.enabled,
        path: pathsById.get(extension.id.toLowerCase()) ?? extension.path,
        version: extension.version
      }))
    });
    return installed;
  }

  private async discoverExtensionFolders(): Promise<string[]> {
    try {
      const entries = await fs.readdir(this.extensionsDir, { withFileTypes: true });
      return entries
        .filter(entry => entry.isDirectory() && !entry.name.includes(".install-"))
        .map(entry => path.join(this.extensionsDir, entry.name));
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") return [];
      throw error;
    }
  }

  private async readInstalledExtension(extensionPath: string, defaultEnabled: boolean): Promise<InstalledExtension> {
    const manifest = await this.readManifest(extensionPath);
    return {
      ...manifest,
      enabled: defaultEnabled,
      path: path.resolve(extensionPath)
    };
  }

  private async readManifest(extensionPath: string): Promise<ExtensionManifest> {
    const packageJsonPath = path.join(extensionPath, "package.json");
    const parsed = parsePackageJson(await fs.readFile(packageJsonPath, "utf8"), packageJsonPath);
    const id = `${parsed.publisher}.${parsed.name}`.toLowerCase();
    const iconPath = parsed.icon ? await existingIconPath(extensionPath, parsed.icon) : undefined;
    return {
      id,
      displayName: parsed.displayName?.trim() || parsed.name,
      version: parsed.version,
      publisher: parsed.publisher,
      description: parsed.description?.trim() || "",
      icon: parsed.icon,
      iconPath,
      categories: parsed.categories ?? []
    };
  }

  private async findPackageRoot(extractedRoot: string): Promise<string> {
    const rootPackageJson = path.join(extractedRoot, "package.json");
    if (await exists(rootPackageJson)) return extractedRoot;

    const extensionPackageJson = path.join(extractedRoot, "extension", "package.json");
    if (await exists(extensionPackageJson)) return path.join(extractedRoot, "extension");

    throw new Error("VSIX invalido: package.json nao encontrado.");
  }

  private async copyVsixManifest(extractedRoot: string, targetRoot: string): Promise<void> {
    const manifestPath = path.join(extractedRoot, "extension.vsixmanifest");
    if (!await exists(manifestPath)) return;
    await fs.copyFile(manifestPath, path.join(targetRoot, "extension.vsixmanifest"));
  }

  private async setEnabled(id: string, enabled: boolean): Promise<void> {
    const registry = await this.loadRegistry();
    const entry = registry.installed.find(item => sameExtensionId(item.id, id));
    if (!entry) throw new Error(`Extensao nao encontrada: ${id}`);
    entry.enabled = enabled;
    await this.saveRegistry(registry);
    console.info(`[NPSharp extensions] ${enabled ? "Enabled" : "Disabled"} ${id}`);
  }

  private async upsertRegistry(extension: InstalledExtension): Promise<void> {
    const registry = await this.loadRegistry();
    const existing = registry.installed.find(item => sameExtensionId(item.id, extension.id));
    const entry: ExtensionRegistryEntry = {
      id: extension.id,
      enabled: existing?.enabled ?? extension.enabled,
      path: extension.path,
      version: extension.version
    };

    registry.installed = [entry, ...registry.installed.filter(item => !sameExtensionId(item.id, extension.id))];
    await this.saveRegistry(registry);
  }

  private async loadRegistry(): Promise<ExtensionRegistry> {
    try {
      const raw = await fs.readFile(this.registryPath, "utf8");
      const parsed = JSON.parse(raw) as Partial<ExtensionRegistry>;
      return {
        installed: Array.isArray(parsed.installed)
          ? parsed.installed
            .filter(isRegistryEntry)
            .map(entry => ({ ...entry, path: path.resolve(entry.path) }))
            .filter(entry => this.isManagedExtensionPath(entry.path))
          : []
      };
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "ENOENT") {
        console.warn(`[NPSharp extensions] Failed to load ${this.registryPath}; registry will be rebuilt.`, error);
      }
      return { installed: [] };
    }
  }

  private async saveRegistry(registry: ExtensionRegistry): Promise<void> {
    await fs.mkdir(this.userDataPath, { recursive: true });
    await fs.writeFile(this.registryPath, JSON.stringify({ installed: registry.installed }, null, 2) + "\n", "utf8");
  }

  private isManagedExtensionPath(extensionPath: string): boolean {
    const relative = path.relative(this.extensionsDir, path.resolve(extensionPath));
    return relative !== "" && !relative.startsWith("..") && !path.isAbsolute(relative);
  }
}

function parsePackageJson(raw: string, filePath: string): ExtensionPackageJson {
  const parsed = JSON.parse(raw) as unknown;
  if (!isRecord(parsed)) throw new Error(`package.json invalido: ${filePath}`);
  const name = stringValue(parsed.name);
  const publisher = stringValue(parsed.publisher);
  const version = stringValue(parsed.version);
  if (!name || !publisher || !version) {
    throw new Error(`Extension package.json requer name, publisher e version: ${filePath}`);
  }
  return {
    name,
    publisher,
    version,
    displayName: stringValue(parsed.displayName),
    description: stringValue(parsed.description),
    icon: stringValue(parsed.icon),
    categories: stringArrayValue(parsed.categories)
  };
}

function isRegistryEntry(value: unknown): value is ExtensionRegistryEntry {
  if (!isRecord(value)) return false;
  return Boolean(stringValue(value.id) && typeof value.enabled === "boolean" && stringValue(value.path) && stringValue(value.version));
}

async function existingIconPath(root: string, icon: string): Promise<string | undefined> {
  const resolved = path.resolve(root, icon);
  const relative = path.relative(root, resolved);
  if (relative.startsWith("..") || path.isAbsolute(relative)) return undefined;
  return await exists(resolved) ? resolved : undefined;
}

async function exists(targetPath: string): Promise<boolean> {
  try {
    await fs.access(targetPath);
    return true;
  } catch {
    return false;
  }
}

function sameExtensionId(left: string, right: string): boolean {
  return left.toLowerCase() === right.toLowerCase();
}

function sanitizeExtensionFolder(id: string): string {
  return id.replace(/[\\/:*?"<>|]+/g, "-").replace(/\s+/g, "-");
}

function parseOpenVsxExtension(value: unknown): OpenVsxExtension | undefined {
  if (!isRecord(value)) return undefined;
  const namespace = stringValue(value.namespace);
  const name = stringValue(value.name);
  const version = stringValue(value.version);
  if (!namespace || !name || !version) return undefined;
  const files = isRecord(value.files) ? value.files : undefined;
  return {
    namespace,
    name,
    version,
    displayName: stringValue(value.displayName) || name,
    description: stringValue(value.description),
    iconUrl: files ? stringValue(files.icon) || undefined : undefined,
    downloads: typeof value.downloads === "number" && Number.isFinite(value.downloads) ? value.downloads : undefined
  };
}

function validateOpenVsxPart(value: string, label: string): string {
  if (!/^[A-Za-z0-9._-]+$/.test(value)) throw new Error(`Identificador Open VSX inválido (${label}).`);
  return value;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function stringValue(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function stringArrayValue(value: unknown): string[] | undefined {
  if (!Array.isArray(value)) return undefined;
  return value.filter((item): item is string => typeof item === "string").map(item => item.trim()).filter(Boolean);
}
