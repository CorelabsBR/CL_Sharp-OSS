/*---------------------------------------------------------------------------------------------
- Copyright (c) CorelabsBR. All rights reserved.
- Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
import fs from "node:fs";
import fsp from "node:fs/promises";
import { createRequire } from "node:module";
import path from "node:path";
import { gunzipSync, gzipSync, inflateRawSync } from "node:zlib";
import JSZip from "jszip";
import mammoth from "mammoth";
import * as XLSX from "xlsx";
import type { FileOpenResult, FileReadResult, StructuredFileSaveRequest, TextEncoding, WorkspaceChangeEvent, WorkspaceEntry } from "../../shared/types";

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

const IMAGE_EXTENSIONS = new Set([".png", ".jpg", ".jpeg", ".jfif", ".gif", ".bmp", ".webp", ".svg", ".ico", ".tiff", ".tif", ".avif"]);
const BINARY_EXTENSIONS = new Set([".exe", ".dll", ".so", ".dylib", ".bin", ".dat", ".elf", ".class", ".jar", ".war", ".ear", ".apk", ".ipa", ".dex", ".o", ".obj", ".a", ".lib", ".wasm", ".pyc", ".pyd"]);
const MEDIA_EXTENSIONS = new Set([".mp3", ".wav", ".ogg", ".oga", ".m4a", ".aac", ".flac", ".mp4", ".webm", ".ogv", ".mov", ".mkv"]);
const ARCHIVE_EXTENSIONS = new Set([".zip", ".jar", ".war", ".ear", ".apk", ".vsix"]);
const NBT_EXTENSIONS = new Set([".nbt", ".schem", ".schematic"]);
const SPREADSHEET_EXTENSIONS = new Set([".xlsx", ".xls", ".xlsm", ".xlsb", ".ods", ".csv", ".tsv"]);
const EDITABLE_DOCUMENT_EXTENSIONS = new Set([".docx", ".odt", ".odf"]);
const DOCUMENT_CONTAINER_EXTENSIONS = new Set([".docx", ".odt", ".ods", ".pptx", ".pages", ".numbers", ".key"]);
const IWORK_PACKAGE_EXTENSIONS = new Set([".pages", ".numbers", ".key"]);
const SQLITE_EXTENSIONS = new Set([".sqlite", ".sqlite3", ".db", ".db3"]);
const GAME_SAVE_EXTENSIONS = new Set([".sav", ".save", ".gam"]);
const MAX_EMBEDDED_PREVIEW_BYTES = 32 * 1024 * 1024;
const MAX_BINARY_PREVIEW_BYTES = 512 * 1024;
const MAX_STRUCTURED_ENTRY_BYTES = 4 * 1024 * 1024;
const optionalRequire = createRequire(__filename);

interface SqlJsQueryResult {
  columns: string[];
  values: unknown[][];
}

interface SqlJsDatabase {
  exec(sql: string): SqlJsQueryResult[];
  close(): void;
}

interface SqlJsModule {
  Database: new (data?: Uint8Array) => SqlJsDatabase;
}

type SqlJsInitializer = () => Promise<SqlJsModule>;

interface ZipEntry {
  name: string;
  compression: number;
  compressedSize: number;
  uncompressedSize: number;
  localHeaderOffset: number;
}

let sqlJsPromise: Promise<SqlJsModule> | undefined;

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
      directory: entry.isDirectory() && !IWORK_PACKAGE_EXTENSIONS.has(path.extname(entry.name).toLowerCase()),
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

async function openEditableDocument(filePath: string, buffer: Buffer, extension: string): Promise<FileOpenResult> {
  let content: string;
  let type: string;
  if (extension === ".docx") {
    const extracted = await mammoth.extractRawText({ buffer });
    content = normalizeDocumentText(extracted.value);
    type = "Word DOCX";
  } else {
    const entries = zipEntries(buffer);
    const xml = entries ? zipText(buffer, entries, "content.xml") : "";
    if (!xml) throw new Error("O pacote OpenDocument não contém content.xml legível.");
    content = normalizeDocumentText(xmlToText(xml));
    type = extension === ".odt" ? "OpenDocument Text (ODT)" : "OpenDocument Text (ODF)";
  }
  return {
    path: filePath,
    name: path.basename(filePath),
    editor: "text",
    size: buffer.byteLength,
    type,
    content,
    editableStructuredKind: "document"
  };
}

function openSpreadsheetFile(filePath: string, buffer: Buffer, extension: string): FileOpenResult {
  try {
    const workbook = XLSX.read(buffer, { type: "buffer", cellFormula: true, cellNF: true, cellText: false, raw: true });
    const sheets = workbook.SheetNames.map(name => spreadsheetSheetToText(name, workbook.Sheets[name])).join("\n\n");
    const content = `# Planilha editável: células são separadas por TAB e fórmulas começam com =.\n# Inicie cada aba com ## Sheet: Nome da aba.\n\n${sheets}`;
    return {
      path: filePath,
      name: path.basename(filePath),
      editor: "text",
      size: buffer.byteLength,
      type: spreadsheetType(extension),
      content: content || "## Sheet: Planilha1\n",
      editableStructuredKind: "spreadsheet"
    };
  } catch (error) {
    throw new Error(`Não foi possível ler esta planilha. ${error instanceof Error ? error.message : String(error)}`);
  }
}

function spreadsheetSheetToText(name: string, sheet: XLSX.WorkSheet | undefined): string {
  const rows: string[] = [`## Sheet: ${name.replace(/[\r\n]/g, " ")}`];
  const ref = sheet?.["!ref"];
  if (!sheet || !ref) return rows.join("\n");
  const range = XLSX.utils.decode_range(ref);
  for (let row = range.s.r; row <= range.e.r; row++) {
    const values: string[] = [];
    for (let column = range.s.c; column <= range.e.c; column++) {
      const cell = sheet[XLSX.utils.encode_cell({ r: row, c: column })];
      const value = cell?.f ? `=${cell.f}` : spreadsheetCellText(cell?.v);
      values.push(value.replace(/[\t\r\n]/g, " "));
    }
    while (values.length && !values.at(-1)) values.pop();
    rows.push(values.join("\t"));
  }
  return rows.join("\n");
}

function spreadsheetCellText(value: unknown): string {
  if (value === undefined || value === null) return "";
  if (value instanceof Date) return value.toISOString();
  return String(value);
}

function spreadsheetType(extension: string): string {
  return ({ ".xlsx": "Excel XLSX", ".xls": "Excel XLS", ".xlsm": "Excel XLSM", ".xlsb": "Excel XLSB", ".ods": "OpenDocument Spreadsheet (ODS)", ".csv": "CSV", ".tsv": "TSV" } as Record<string, string>)[extension] ?? "Planilha";
}

function normalizeDocumentText(content: string): string {
  return content.replace(/\r\n?/g, "\n").replace(/\n{3,}/g, "\n\n").trimEnd();
}

/** Resolves the editor from both the file signature/content and its extension. */
export async function openFile(targetPath: string, forceText = false): Promise<FileOpenResult> {
  const filePath = normalizeFsPath(targetPath);
  const extension = path.extname(filePath).toLowerCase();
  const stat = await fsp.stat(filePath);
  if (!forceText && stat.isDirectory() && IWORK_PACKAGE_EXTENSIONS.has(extension)) {
    return inspectIworkDirectory(filePath);
  }
  if (stat.isDirectory()) throw new Error("O caminho selecionado é uma pasta, não um arquivo.");
  const buffer = await fsp.readFile(filePath);
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

  if (!forceText && SPREADSHEET_EXTENSIONS.has(extension)) {
    return openSpreadsheetFile(filePath, buffer, extension);
  }

  if (!forceText && EDITABLE_DOCUMENT_EXTENSIONS.has(extension) && isZipArchive(buffer)) {
    return await openEditableDocument(filePath, buffer, extension);
  }

  if (!forceText && DOCUMENT_CONTAINER_EXTENSIONS.has(extension) && isZipArchive(buffer)) {
    const preview = inspectDocumentContainer(extension, buffer);
    return {
      path: filePath,
      name: path.basename(filePath),
      editor: "document",
      size: buffer.byteLength,
      type: preview.type,
      content: preview.content,
      previewSummary: preview.summary
    };
  }

  if (!forceText && SQLITE_EXTENSIONS.has(extension) && isSqliteDatabase(buffer)) {
    const preview = await inspectSqliteDatabase(buffer);
    return {
      path: filePath,
      name: path.basename(filePath),
      editor: "database",
      size: buffer.byteLength,
      type: "SQLite",
      content: preview,
      previewSummary: "Banco SQLite em modo somente leitura"
    };
  }

  if (!forceText && extension === ".psd" && isPsd(buffer)) {
    return structuredPreview(filePath, buffer, type, "design", inspectPsd(buffer), "Documento Photoshop em modo somente leitura");
  }

  if (!forceText && extension === ".blend" && isBlender(buffer)) {
    return structuredPreview(filePath, buffer, type, "design", inspectBlender(buffer), "Projeto Blender em modo somente leitura");
  }

  if (!forceText && extension === ".dwg" && isDwg(buffer)) {
    return structuredPreview(filePath, buffer, type, "design", inspectDwg(buffer), "Desenho AutoCAD em modo somente leitura");
  }

  if (!forceText && extension === ".pub" && isOleCompoundDocument(buffer)) {
    return structuredPreview(filePath, buffer, type, "design", inspectPublisher(buffer), "Documento Microsoft Publisher em modo somente leitura");
  }

  if (!forceText && GAME_SAVE_EXTENSIONS.has(extension)) {
    const nbt = tryParseNbt(buffer);
    return structuredPreview(
      filePath,
      buffer,
      type,
      "game",
      nbt ?? inspectGameSave(buffer),
      nbt ? "Savegame NBT em modo somente leitura" : "Savegame reconhecido em modo somente leitura"
    );
  }

  if (!forceText && (NBT_EXTENSIONS.has(extension) || extension === ".dat")) {
    const nbt = tryParseNbt(buffer);
    if (nbt) {
      return {
        path: filePath,
        name: path.basename(filePath),
        editor: "text",
        size: buffer.byteLength,
        type: "NBT",
        content: nbt,
        editableStructuredKind: "nbt"
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

function structuredPreview(
  filePath: string,
  buffer: Buffer,
  type: string,
  editor: "document" | "database" | "design" | "game",
  content: string,
  previewSummary: string
): FileOpenResult {
  return {
    path: filePath,
    name: path.basename(filePath),
    editor,
    size: buffer.byteLength,
    type,
    content,
    previewSummary
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
    case ".jpg": case ".jpeg": case ".jfif": return startsWith(0xff, 0xd8, 0xff);
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
  const entries = zipEntries(buffer);
  if (!entries) return "Arquivo ZIP reconhecido, mas o índice central não pôde ser lido.";
  const names = entries.slice(0, 1000).map(entry => entry.name);
  const suffix = entries.length > names.length ? `\n… e mais ${entries.length - names.length} entradas.` : "";
  return `${entries.length} entrada(s)\n\n${names.join("\n")}${suffix}`;
}

function inspectDocumentContainer(extension: string, buffer: Buffer): { type: string; summary: string; content: string } {
  const entries = zipEntries(buffer);
  if (!entries) return { type: extension.slice(1).toUpperCase(), summary: "Contêiner reconhecido, mas não foi possível ler o índice.", content: inspectZip(buffer) };

  switch (extension) {
    case ".docx": return inspectDocx(buffer, entries);
    case ".odt": return inspectOdt(buffer, entries);
    case ".ods": return inspectOds(buffer, entries);
    case ".pptx": return inspectPptx(buffer, entries);
    case ".pages": case ".numbers": case ".key": return inspectIwork(extension, buffer, entries);
    default: return { type: extension.slice(1).toUpperCase(), summary: "Documento compactado em modo somente leitura", content: inspectZip(buffer) };
  }
}

function inspectDocx(buffer: Buffer, entries: ZipEntry[]): { type: string; summary: string; content: string } {
  const body = zipText(buffer, entries, "word/document.xml");
  const headers = entries.filter(entry => /^word\/(?:header|footer)\d+\.xml$/i.test(entry.name));
  const notes = entries.filter(entry => /^word\/(?:footnotes|endnotes|comments)\.xml$/i.test(entry.name));
  const media = entries.filter(entry => /^word\/media\//i.test(entry.name));
  const sections = [
    ["Documento", xmlToText(body)],
    ...headers.map(entry => [`Cabeçalho/Rodapé: ${entry.name.split("/").pop()}`, xmlToText(zipText(buffer, entries, entry.name))]),
    ...notes.map(entry => [`Notas: ${entry.name.split("/").pop()}`, xmlToText(zipText(buffer, entries, entry.name))])
  ].filter((section): section is [string, string] => Boolean(section[1]));
  return {
    type: "Word DOCX",
    summary: `${headers.length} cabeçalho(s)/rodapé(s), ${notes.length} arquivo(s) de notas/comentários e ${media.length} imagem(ns)/mídia(s).`,
    content: formatStructuredSections(sections, `Elementos no pacote: ${entries.length}\nImagens e mídia: ${media.map(entry => entry.name).join(", ") || "nenhuma"}`)
  };
}

function inspectOdt(buffer: Buffer, entries: ZipEntry[]): { type: string; summary: string; content: string } {
  const content = zipText(buffer, entries, "content.xml");
  const styles = zipText(buffer, entries, "styles.xml");
  const images = entries.filter(entry => /^Pictures\//i.test(entry.name));
  const notes = countMatches(content, /<text:note\b/gi);
  const headers = countMatches(styles, /<style:header\b|<style:footer\b/gi);
  return {
    type: "OpenDocument Text (ODT)",
    summary: `${headers} cabeçalho(s)/rodapé(s), ${notes} nota(s) e ${images.length} imagem(ns).`,
    content: formatStructuredSections([["Conteúdo", xmlToText(content)]], `Imagens: ${images.map(entry => entry.name).join(", ") || "nenhuma"}`)
  };
}

function inspectOds(buffer: Buffer, entries: ZipEntry[]): { type: string; summary: string; content: string } {
  const content = zipText(buffer, entries, "content.xml");
  const sheets = [...content.matchAll(/<table:table\b[^>]*table:name="([^"]+)"/gi)].map(match => decodeXml(match[1]));
  const formulas = countMatches(content, /table:formula=/gi);
  const formulaSamples = [...content.matchAll(/table:formula="([^"]+)"/gi)].slice(0, 50).map(match => decodeXml(match[1]));
  const charts = entries.filter(entry => /(?:^|\/)Object(?:Replacements)?\//i.test(entry.name) || /chart/i.test(entry.name));
  return {
    type: "OpenDocument Spreadsheet (ODS)",
    summary: `${sheets.length} aba(s), ${formulas} fórmula(s) e ${charts.length} recurso(s) de gráfico/objeto.`,
    content: formatStructuredSections([["Planilha", xmlToText(content)]], `Abas: ${sheets.join(", ") || "não identificadas"}\nFórmulas encontradas: ${formulas}\nAmostra de fórmulas: ${formulaSamples.join(" | ") || "nenhuma"}\nGráficos/objetos: ${charts.map(entry => entry.name).join(", ") || "nenhum"}`)
  };
}

function inspectPptx(buffer: Buffer, entries: ZipEntry[]): { type: string; summary: string; content: string } {
  const slides = entries
    .filter(entry => /^ppt\/slides\/slide\d+\.xml$/i.test(entry.name))
    .sort((left, right) => left.name.localeCompare(right.name, undefined, { numeric: true }));
  const notes = entries.filter(entry => /^ppt\/notesSlides\/notesSlide\d+\.xml$/i.test(entry.name));
  const embeds = entries.filter(entry => /^ppt\/(?:embeddings|media)\//i.test(entry.name));
  const animations = slides.reduce((total, entry) => total + countMatches(zipText(buffer, entries, entry.name), /<p:timing\b/gi), 0);
  const sections: Array<[string, string]> = slides.map((entry, index) => [`Slide ${index + 1}`, xmlToText(zipText(buffer, entries, entry.name))]);
  return {
    type: "PowerPoint PPTX",
    summary: `${slides.length} slide(s), ${animations} sequência(s) de animação, ${notes.length} nota(s) e ${embeds.length} objeto(s)/mídia(s) incorporado(s).`,
    content: formatStructuredSections(sections, `Notas: ${notes.map(entry => entry.name).join(", ") || "nenhuma"}\nObjetos e mídia: ${embeds.map(entry => entry.name).join(", ") || "nenhum"}`)
  };
}

function inspectIwork(extension: string, buffer: Buffer, entries: ZipEntry[]): { type: string; summary: string; content: string } {
  const names = { ".pages": "Apple Pages", ".numbers": "Apple Numbers", ".key": "Apple Keynote" } as Record<string, string>;
  const previews = entries.filter(entry => /^QuickLook\/Preview\.(?:pdf|jpg|jpeg|png)$/i.test(entry.name));
  const indexFiles = entries.filter(entry => /(?:^|\/)Index\/.*\.iwa$/i.test(entry.name));
  const media = entries.filter(entry => /(?:^|\/)(?:Data|Metadata|QuickLook)\//i.test(entry.name));
  return {
    type: names[extension],
    summary: `${indexFiles.length} índice(s) iWork, ${previews.length} prévia(s) QuickLook e ${media.length} recurso(s) interno(s).`,
    content: `${names[extension]} é um pacote iWork. A estrutura abaixo foi preservada e inspecionada em modo somente leitura.\n\nPrévias disponíveis: ${previews.map(entry => entry.name).join(", ") || "nenhuma"}\n\n${inspectZip(buffer)}`
  };
}

async function inspectIworkDirectory(filePath: string): Promise<FileOpenResult> {
  const entries = await listPackageEntries(filePath);
  const extension = path.extname(filePath).toLowerCase();
  const names = { ".pages": "Apple Pages", ".numbers": "Apple Numbers", ".key": "Apple Keynote" } as Record<string, string>;
  const previews = entries.filter(entry => /^QuickLook\/Preview\.(?:pdf|jpg|jpeg|png)$/i.test(entry));
  const indexFiles = entries.filter(entry => /(?:^|\/)Index\/.*\.iwa$/i.test(entry));
  return {
    path: filePath,
    name: path.basename(filePath),
    editor: "document",
    size: 0,
    type: names[extension],
    previewSummary: `Pacote iWork com ${entries.length} recurso(s), ${indexFiles.length} índice(s) e ${previews.length} prévia(s).`,
    content: `${names[extension]} foi aberto como pacote iWork em modo somente leitura.\n\nPrévias disponíveis: ${previews.join(", ") || "nenhuma"}\n\n${entries.join("\n") || "Pacote vazio."}`
  };
}

async function listPackageEntries(root: string, relative = "", output: string[] = []): Promise<string[]> {
  if (output.length >= 2_000) return output;
  const entries = await fsp.readdir(path.join(root, relative), { withFileTypes: true });
  for (const entry of entries) {
    const next = path.join(relative, entry.name);
    if (entry.isDirectory()) await listPackageEntries(root, next, output);
    else output.push(next.replace(/\\/g, "/"));
    if (output.length >= 2_000) break;
  }
  return output;
}

function zipEntries(buffer: Buffer): ZipEntry[] | undefined {
  const signature = Buffer.from([0x50, 0x4b, 0x05, 0x06]);
  const offset = buffer.lastIndexOf(signature);
  if (offset < 0 || offset + 22 > buffer.length) return undefined;
  const count = buffer.readUInt16LE(offset + 10);
  let cursor = buffer.readUInt32LE(offset + 16);
  const entries: ZipEntry[] = [];
  for (let index = 0; index < count; index++) {
    if (cursor + 46 > buffer.length || buffer.readUInt32LE(cursor) !== 0x02014b50) return undefined;
    const compression = buffer.readUInt16LE(cursor + 10);
    const compressedSize = buffer.readUInt32LE(cursor + 20);
    const uncompressedSize = buffer.readUInt32LE(cursor + 24);
    const nameLength = buffer.readUInt16LE(cursor + 28);
    const extraLength = buffer.readUInt16LE(cursor + 30);
    const commentLength = buffer.readUInt16LE(cursor + 32);
    const localHeaderOffset = buffer.readUInt32LE(cursor + 42);
    if (cursor + 46 + nameLength > buffer.length) return undefined;
    entries.push({ name: buffer.subarray(cursor + 46, cursor + 46 + nameLength).toString("utf8"), compression, compressedSize, uncompressedSize, localHeaderOffset });
    cursor += 46 + nameLength + extraLength + commentLength;
  }
  return entries;
}

function zipText(buffer: Buffer, entries: ZipEntry[], name: string): string {
  const entry = entries.find(item => item.name === name);
  if (!entry || entry.uncompressedSize > MAX_STRUCTURED_ENTRY_BYTES) return "";
  const offset = entry.localHeaderOffset;
  if (offset + 30 > buffer.length || buffer.readUInt32LE(offset) !== 0x04034b50) return "";
  const nameLength = buffer.readUInt16LE(offset + 26);
  const extraLength = buffer.readUInt16LE(offset + 28);
  const start = offset + 30 + nameLength + extraLength;
  const end = start + entry.compressedSize;
  if (end > buffer.length) return "";
  try {
    const payload = buffer.subarray(start, end);
    const plain = entry.compression === 0 ? payload : entry.compression === 8 ? inflateRawSync(payload) : undefined;
    return plain?.subarray(0, MAX_STRUCTURED_ENTRY_BYTES).toString("utf8") ?? "";
  } catch {
    return "";
  }
}

function xmlToText(xml: string): string {
  if (!xml) return "";
  return decodeXml(xml
    .replace(/<(?:w:p|text:p|text:h|p:sp|p:graphicFrame|table:table-row)\b[^>]*>/gi, "\n")
    .replace(/<w:tc\b[^>]*>/gi, " | ")
    .replace(/<table:table-cell\b[^>]*>/gi, " | ")
    .replace(/<(?:w:br|text:line-break)\b[^>]*\/?\s*>/gi, "\n")
    .replace(/<w:tab\b[^>]*\/?\s*>/gi, "\t")
    .replace(/<[^>]+>/g, "")
    .replace(/\r/g, "")
    .replace(/\n[ \t]*\n+/g, "\n")
    .replace(/[ \t]{2,}/g, " ")
    .trim());
}

function decodeXml(value: string): string {
  return value.replace(/&(?:amp|lt|gt|quot|apos|#\d+|#x[\da-f]+);/gi, entity => {
    const named: Record<string, string> = { "&amp;": "&", "&lt;": "<", "&gt;": ">", "&quot;": "\"", "&apos;": "'" };
    if (named[entity.toLowerCase()]) return named[entity.toLowerCase()];
    const hex = /^&#x([\da-f]+);$/i.exec(entity);
    const decimal = /^&#(\d+);$/i.exec(entity);
    return String.fromCodePoint(Number.parseInt(hex?.[1] ?? decimal?.[1] ?? "0", hex ? 16 : 10));
  });
}

function countMatches(value: string, pattern: RegExp): number { return [...value.matchAll(pattern)].length; }

function formatStructuredSections(sections: Array<[string, string]>, trailer: string): string {
  const body = sections.filter(([, content]) => content).map(([title, content]) => `## ${title}\n\n${content}`).join("\n\n");
  return [body, trailer].filter(Boolean).join("\n\n").trim() || "Não foi possível extrair texto legível deste documento.";
}

function isSqliteDatabase(buffer: Buffer): boolean {
  return buffer.subarray(0, 16).toString("ascii") === "SQLite format 3\u0000";
}

async function inspectSqliteDatabase(buffer: Buffer): Promise<string> {
  try {
    const SQL = await loadSqlJs();
    const database = new SQL.Database(buffer);
    try {
      const header = `SQLite 3\nPágina: ${buffer.readUInt16BE(16) || 65536} bytes\nTamanho: ${buffer.byteLength.toLocaleString("pt-BR")} bytes`;
      const schema = database.exec("SELECT type, name, tbl_name, sql FROM sqlite_master WHERE type IN ('table', 'view', 'index', 'trigger') ORDER BY type, name");
      const rows = schema[0]?.values ?? [];
      const tables = rows.filter(row => row[0] === "table" && typeof row[1] === "string" && !String(row[1]).startsWith("sqlite_"));
      const sections = [header, "## Esquema", ...rows.map(row => `${row[0]} ${row[1]}${row[3] ? `\n${row[3]}` : ""}`)];
      for (const table of tables.slice(0, 40)) {
        const name = String(table[1]);
        const escaped = name.replace(/"/g, "\"\"");
        const result = database.exec(`SELECT * FROM "${escaped}" LIMIT 50`)[0];
        if (!result) continue;
        const lines = [result.columns.join(" | "), ...result.values.map(row => row.map(value => formatSqliteValue(value)).join(" | "))];
        sections.push(`## ${name}`, lines.join("\n"));
      }
      const integrity = database.exec("PRAGMA integrity_check")[0]?.values[0]?.[0];
      sections.push(`Integridade: ${integrity ?? "não verificada"}`);
      return sections.join("\n\n");
    } finally {
      database.close();
    }
  } catch (error) {
    return `SQLite reconhecido, mas não foi possível abrir sua estrutura com segurança.\n\n${error instanceof Error ? error.message : String(error)}`;
  }
}

function formatSqliteValue(value: unknown): string {
  if (value === null) return "NULL";
  if (value instanceof Uint8Array) return `<BLOB ${value.byteLength} bytes>`;
  const text = String(value).replace(/[\r\n]+/g, " ");
  return text.length > 500 ? `${text.slice(0, 497)}…` : text;
}

function loadSqlJs(): Promise<SqlJsModule> {
  if (!sqlJsPromise) {
    const initialize = optionalRequire("sql.js/dist/sql-asm.js") as SqlJsInitializer;
    sqlJsPromise = initialize();
  }
  return sqlJsPromise;
}

function isPsd(buffer: Buffer): boolean { return buffer.subarray(0, 4).toString("ascii") === "8BPS" && buffer.length >= 30; }

function inspectPsd(buffer: Buffer): string {
  const channels = buffer.readUInt16BE(12);
  const height = buffer.readUInt32BE(14);
  const width = buffer.readUInt32BE(18);
  const depth = buffer.readUInt16BE(22);
  const modes: Record<number, string> = { 0: "Bitmap", 1: "Grayscale", 2: "Indexed", 3: "RGB", 4: "CMYK", 7: "Multichannel", 8: "Duotone", 9: "Lab" };
  let layerCount = "não identificado";
  try {
    let offset = 26;
    offset += 4 + buffer.readUInt32BE(offset);
    offset += 4 + buffer.readUInt32BE(offset);
    const layerInfoLength = buffer.readUInt32BE(offset); offset += 4;
    if (layerInfoLength >= 2 && offset + 2 <= buffer.length) layerCount = String(Math.abs(buffer.readInt16BE(offset)));
  } catch {
    // The header is still useful even if a truncated PSD has no layer section.
  }
  return `Adobe Photoshop PSD\nDimensões: ${width} × ${height}px\nCanais: ${channels}\nProfundidade: ${depth} bits\nModo de cor: ${modes[buffer.readUInt16BE(24)] ?? "desconhecido"}\nCamadas: ${layerCount}`;
}

function isBlender(buffer: Buffer): boolean { return buffer.subarray(0, 7).toString("ascii") === "BLENDER"; }

function inspectBlender(buffer: Buffer): string {
  const pointerSize = buffer.subarray(7, 8).toString("ascii") === "-" ? "64 bits" : "32 bits";
  const endianness = buffer.subarray(8, 9).toString("ascii") === "v" ? "little-endian" : "big-endian";
  const version = buffer.subarray(9, 12).toString("ascii");
  return `Projeto Blender\nVersão do arquivo: ${version || "desconhecida"}\nPonteiros: ${pointerSize}\nOrdem de bytes: ${endianness}\n\nA estrutura de cenas, objetos, malhas e recursos é preservada no arquivo original; a edição requer o Blender para manter compatibilidade total.`;
}

function isDwg(buffer: Buffer): boolean { return /^AC\d{4}$/.test(buffer.subarray(0, 6).toString("ascii")); }

function inspectDwg(buffer: Buffer): string {
  const version = buffer.subarray(0, 6).toString("ascii");
  const versions: Record<string, string> = { AC1015: "AutoCAD 2000", AC1018: "AutoCAD 2004", AC1021: "AutoCAD 2007", AC1024: "AutoCAD 2010", AC1027: "AutoCAD 2013", AC1032: "AutoCAD 2018" };
  return `Desenho AutoCAD DWG\nAssinatura: ${version}\nVersão: ${versions[version] ?? "versão DWG reconhecida"}\n\nA geometria e os objetos permanecem intactos; a edição e a renderização completas exigem um motor CAD compatível com esta versão.`;
}

function isOleCompoundDocument(buffer: Buffer): boolean {
  return buffer.subarray(0, 8).equals(Buffer.from([0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1]));
}

function inspectPublisher(buffer: Buffer): string {
  const printable = buffer.subarray(0, Math.min(buffer.length, MAX_BINARY_PREVIEW_BYTES)).toString("utf16le").match(/[\p{L}\p{N}][\p{L}\p{N} ._\-/]{3,}/gu) ?? [];
  const names = [...new Set(printable)].slice(0, 100);
  return `Microsoft Publisher PUB\nContêiner: OLE Compound Document\nTamanho: ${buffer.byteLength.toLocaleString("pt-BR")} bytes\n\nStreams/metadados identificáveis:\n${names.join("\n") || "Nenhum nome de stream legível encontrado."}\n\nO formato PUB é proprietário; o Sharp-OSS o abre de forma segura para inspeção e preserva todos os recursos originais.`;
}

function inspectGameSave(buffer: Buffer): string {
  const signature = buffer.subarray(0, Math.min(buffer.length, 16)).toString("ascii").replace(/[^\x20-\x7e]/g, ".");
  const kind = buffer.subarray(0, 4).toString("ascii") === "GVAS" ? "Unreal Engine SaveGame" : buffer.subarray(0, 7).toString("ascii") === "UnityFS" ? "Unity asset/save container" : "Formato de savegame não identificado";
  return `${kind}\nAssinatura: ${signature || "vazia"}\nTamanho: ${buffer.byteLength.toLocaleString("pt-BR")} bytes\n\nO arquivo foi aberto em modo somente leitura para evitar corromper o progresso. A prévia hexadecimal contém os bytes originais disponíveis.`;
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

async function saveNbtFile(filePath: string, content: string): Promise<void> {
  let parsed: unknown;
  try {
    parsed = JSON.parse(content);
  } catch (error) {
    throw new Error(`NBT precisa ser JSON válido antes de salvar. ${error instanceof Error ? error.message : String(error)}`);
  }
  if (!parsed || Array.isArray(parsed) || typeof parsed !== "object") {
    throw new Error("O JSON NBT precisa conter um objeto raiz.");
  }
  const rootEntries = Object.entries(parsed as Record<string, unknown>);
  const [rootName, rootValue] = rootEntries.length === 1 ? rootEntries[0] : ["root", parsed];
  if (!rootValue || Array.isArray(rootValue) || typeof rootValue !== "object") {
    throw new Error("A raiz NBT deve ser um compound (objeto JSON).");
  }
  const source = await fsp.readFile(filePath).catch(() => Buffer.alloc(0));
  const binary = encodeNbtRoot(rootName, rootValue);
  await fsp.writeFile(filePath, source.subarray(0, 2).equals(Buffer.from([0x1f, 0x8b])) ? gzipSync(binary) : binary);
}

function encodeNbtRoot(name: string, value: object): Buffer {
  const chunks: Buffer[] = [Buffer.from([10]), encodeNbtString(name)];
  encodeNbtPayload(10, value, chunks);
  return Buffer.concat(chunks);
}

function encodeNbtPayload(type: number, value: unknown, chunks: Buffer[]): void {
  switch (type) {
    case 1: chunks.push(Buffer.from([Number(value) & 0xff])); return;
    case 2: { const buffer = Buffer.allocUnsafe(2); buffer.writeInt16BE(Number(value)); chunks.push(buffer); return; }
    case 3: { const buffer = Buffer.allocUnsafe(4); buffer.writeInt32BE(Number(value)); chunks.push(buffer); return; }
    case 4: { const buffer = Buffer.allocUnsafe(8); buffer.writeBigInt64BE(nbtLong(value)); chunks.push(buffer); return; }
    case 5: { const buffer = Buffer.allocUnsafe(4); buffer.writeFloatBE(Number(value)); chunks.push(buffer); return; }
    case 6: { const buffer = Buffer.allocUnsafe(8); buffer.writeDoubleBE(Number(value)); chunks.push(buffer); return; }
    case 8: chunks.push(encodeNbtString(String(value))); return;
    case 9: {
      const list = Array.isArray(value) ? value : [];
      const elementType = list.length ? nbtTypeFor(list[0]) : 1;
      chunks.push(Buffer.from([elementType]), encodeNbtInt(list.length));
      for (const item of list) encodeNbtPayload(elementType, item, chunks);
      return;
    }
    case 10: {
      const object = value as Record<string, unknown>;
      for (const [key, child] of Object.entries(object)) {
        const childType = nbtTypeFor(child);
        chunks.push(Buffer.from([childType]), encodeNbtString(key));
        encodeNbtPayload(childType, child, chunks);
      }
      chunks.push(Buffer.from([0]));
      return;
    }
    default: throw new Error(`Tipo NBT ${type} não suportado para gravação.`);
  }
}

function nbtTypeFor(value: unknown): number {
  if (typeof value === "boolean") return 1;
  if (typeof value === "number") return Number.isInteger(value) && value >= -2147483648 && value <= 2147483647 ? 3 : 6;
  if (typeof value === "string" && /^-?\d+n$/.test(value)) return 4;
  if (typeof value === "string") return 8;
  if (Array.isArray(value)) return 9;
  if (value && typeof value === "object") return 10;
  throw new Error("Valores NBT devem ser booleanos, números, strings, listas ou objetos.");
}

function encodeNbtString(value: string): Buffer {
  const text = Buffer.from(value, "utf8");
  if (text.byteLength > 65535) throw new Error("Uma string NBT não pode ultrapassar 65.535 bytes.");
  const length = Buffer.allocUnsafe(2);
  length.writeUInt16BE(text.byteLength);
  return Buffer.concat([length, text]);
}

function encodeNbtInt(value: number): Buffer {
  const buffer = Buffer.allocUnsafe(4);
  buffer.writeInt32BE(value);
  return buffer;
}

function nbtLong(value: unknown): bigint {
  if (typeof value === "string" && /^-?\d+n$/.test(value)) return BigInt(value.slice(0, -1));
  if (typeof value === "bigint") return value;
  return BigInt(Math.trunc(Number(value)));
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
    ".png": "image/png", ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".jfif": "image/jpeg", ".gif": "image/gif", ".bmp": "image/bmp", ".webp": "image/webp", ".svg": "image/svg+xml", ".ico": "image/x-icon", ".tiff": "image/tiff", ".tif": "image/tiff", ".avif": "image/avif",
    ".pdf": "application/pdf", ".mp3": "audio/mpeg", ".wav": "audio/wav", ".ogg": "audio/ogg", ".oga": "audio/ogg", ".m4a": "audio/mp4", ".aac": "audio/aac", ".flac": "audio/flac",
    ".mp4": "video/mp4", ".webm": "video/webm", ".ogv": "video/ogg", ".mov": "video/quicktime", ".mkv": "video/x-matroska"
  } as Record<string, string>)[extension] ?? "application/octet-stream";
}

export async function saveStructuredFile(request: StructuredFileSaveRequest): Promise<void> {
  const filePath = normalizeFsPath(request.path);
  switch (request.kind) {
    case "spreadsheet":
      await saveSpreadsheetFile(filePath, request.content);
      return;
    case "document":
      await saveEditableDocument(filePath, request.content);
      return;
    case "nbt":
      await saveNbtFile(filePath, request.content);
      return;
    default:
      throw new Error("Formato estruturado não suportado.");
  }
}

async function saveSpreadsheetFile(filePath: string, content: string): Promise<void> {
  const sheets = parseSpreadsheetText(content);
  if (!sheets.length) throw new Error("A planilha precisa conter ao menos uma aba iniciada por '## Sheet:'.");
  const workbook = XLSX.utils.book_new();
  for (const sheetData of sheets) {
    const sheet = XLSX.utils.aoa_to_sheet([]);
    sheetData.rows.forEach((row, rowIndex) => row.forEach((value, columnIndex) => {
      if (!value) return;
      const address = XLSX.utils.encode_cell({ r: rowIndex, c: columnIndex });
      if (value.startsWith("=") && value.length > 1) {
        sheet[address] = { t: "n", f: value.slice(1), v: 0 };
      } else if (/^-?(?:\d+\.?\d*|\.\d+)(?:e[+-]?\d+)?$/i.test(value)) {
        sheet[address] = { t: "n", v: Number(value) };
      } else if (/^(true|false)$/i.test(value)) {
        sheet[address] = { t: "b", v: value.toLowerCase() === "true" };
      } else {
        sheet[address] = { t: "s", v: value };
      }
    }));
    if (sheetData.rows.length && sheetData.rows.some(row => row.length)) {
      const columns = Math.max(...sheetData.rows.map(row => row.length));
      sheet["!ref"] = XLSX.utils.encode_range({ s: { r: 0, c: 0 }, e: { r: sheetData.rows.length - 1, c: Math.max(columns - 1, 0) } });
    }
    XLSX.utils.book_append_sheet(workbook, sheet, sheetData.name.slice(0, 31) || "Planilha");
  }
  const extension = path.extname(filePath).toLowerCase();
  const bookType = ({ ".xls": "biff8", ".xlsm": "xlsm", ".xlsb": "xlsb", ".ods": "ods", ".csv": "csv", ".tsv": "txt" } as Record<string, XLSX.BookType>)[extension] ?? "xlsx";
  const output = XLSX.write(workbook, { type: "buffer", bookType, bookSST: true });
  await fsp.writeFile(filePath, output);
}

function parseSpreadsheetText(content: string): Array<{ name: string; rows: string[][] }> {
  const sheets: Array<{ name: string; rows: string[][] }> = [];
  let active: { name: string; rows: string[][] } | undefined;
  for (const line of content.replace(/\r\n?/g, "\n").split("\n")) {
    const header = /^##\s+Sheet:\s*(.*)$/i.exec(line);
    if (header) {
      active = { name: header[1].trim() || `Planilha${sheets.length + 1}`, rows: [] };
      sheets.push(active);
    } else if (active) {
      active.rows.push(line.split("\t"));
    }
  }
  return sheets;
}

async function saveEditableDocument(filePath: string, content: string): Promise<void> {
  const extension = path.extname(filePath).toLowerCase();
  if (extension === ".docx") {
    await fsp.writeFile(filePath, await createDocx(content));
    return;
  }
  if (extension === ".odt" || extension === ".odf") {
    await fsp.writeFile(filePath, await createOdt(content));
    return;
  }
  throw new Error("A edição estruturada requer um arquivo DOCX, ODT ou ODF.");
}

async function createDocx(content: string): Promise<Buffer> {
  const zip = new JSZip();
  const paragraphs = content.split(/\r\n?|\n/).map(line => `<w:p><w:r><w:t xml:space="preserve">${escapeXml(line)}</w:t></w:r></w:p>`).join("");
  zip.file("[Content_Types].xml", `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/></Types>`);
  zip.file("_rels/.rels", `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>`);
  zip.file("word/document.xml", `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body>${paragraphs}<w:sectPr><w:pgSz w:w="12240" w:h="15840"/><w:pgMar w:top="1440" w:right="1440" w:bottom="1440" w:left="1440"/></w:sectPr></w:body></w:document>`);
  return await zip.generateAsync({ type: "nodebuffer", compression: "DEFLATE" });
}

async function createOdt(content: string): Promise<Buffer> {
  const zip = new JSZip();
  const paragraphs = content.split(/\r\n?|\n/).map(line => `<text:p>${escapeXml(line) || " "}</text:p>`).join("");
  zip.file("mimetype", "application/vnd.oasis.opendocument.text", { compression: "STORE" });
  zip.file("content.xml", `<?xml version="1.0" encoding="UTF-8"?><office:document-content xmlns:office="urn:oasis:names:tc:opendocument:xmlns:office:1.0" xmlns:text="urn:oasis:names:tc:opendocument:xmlns:text:1.0" office:version="1.2"><office:body><office:text>${paragraphs}</office:text></office:body></office:document-content>`);
  zip.file("styles.xml", `<?xml version="1.0" encoding="UTF-8"?><office:document-styles xmlns:office="urn:oasis:names:tc:opendocument:xmlns:office:1.0" office:version="1.2"/>`);
  zip.file("meta.xml", `<?xml version="1.0" encoding="UTF-8"?><office:document-meta xmlns:office="urn:oasis:names:tc:opendocument:xmlns:office:1.0" office:version="1.2"/>`);
  zip.file("META-INF/manifest.xml", `<?xml version="1.0" encoding="UTF-8"?><manifest:manifest xmlns:manifest="urn:oasis:names:tc:opendocument:xmlns:manifest:1.0" manifest:version="1.2"><manifest:file-entry manifest:full-path="/" manifest:media-type="application/vnd.oasis.opendocument.text"/><manifest:file-entry manifest:full-path="content.xml" manifest:media-type="text/xml"/><manifest:file-entry manifest:full-path="styles.xml" manifest:media-type="text/xml"/><manifest:file-entry manifest:full-path="meta.xml" manifest:media-type="text/xml"/></manifest:manifest>`);
  return await zip.generateAsync({ type: "nodebuffer", compression: "DEFLATE" });
}

function escapeXml(value: string): string {
  return value.replace(/[<>&"']/g, character => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;", "\"": "&quot;", "'": "&apos;" })[character] ?? character);
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
  const { shell } = optionalRequire("electron") as typeof import("electron");
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
