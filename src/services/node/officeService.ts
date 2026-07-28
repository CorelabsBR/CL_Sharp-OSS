/*---------------------------------------------------------------------------------------------
- Copyright (c) CorelabsBR. All rights reserved.
- Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
import fs from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { spawn } from "node:child_process";
import type { OfficeSuiteStatus } from "../../shared/types";

const OFFICE_EXTENSIONS = new Set([".doc", ".docx", ".odt", ".odf", ".rtf", ".xlsx", ".xls", ".xlsm", ".xlsb", ".ods", ".csv", ".tsv", ".ppt", ".pptx", ".odp"]);
let executablePromise: Promise<string | undefined> | undefined;

export async function officeSuiteStatus(): Promise<OfficeSuiteStatus> {
  const executable = await findLibreOffice();
  return { available: Boolean(executable), name: "LibreOffice", executable };
}

export async function openInOfficeSuite(targetPath: string): Promise<void> {
  const filePath = path.resolve(targetPath);
  const extension = path.extname(filePath).toLowerCase();
  if (!OFFICE_EXTENSIONS.has(extension)) throw new Error("Este arquivo não é compatível com a suíte Office integrada.");
  await fs.access(filePath);
  const executable = await findLibreOffice();
  if (!executable) throw new Error("LibreOffice não foi encontrado. Instale o LibreOffice para editar documentos preservando formatação, mídia e revisões.");
  const child = spawn(executable, [filePath], { detached: process.platform !== "win32", stdio: "ignore", windowsHide: false });
  child.once("error", () => undefined);
  child.unref();
}

function findLibreOffice(): Promise<string | undefined> {
  executablePromise ??= findExecutable();
  return executablePromise;
}

async function findExecutable(): Promise<string | undefined> {
  const candidates = process.platform === "win32"
    ? [
      path.join(process.env.ProgramFiles ?? "C:\\Program Files", "LibreOffice", "program", "soffice.exe"),
      path.join(process.env["ProgramFiles(x86)"] ?? "C:\\Program Files (x86)", "LibreOffice", "program", "soffice.exe")
    ]
    : process.platform === "darwin"
      ? ["/Applications/LibreOffice.app/Contents/MacOS/soffice"]
      : ["/usr/bin/libreoffice", "/usr/bin/soffice", "/snap/bin/libreoffice"];
  for (const candidate of candidates) {
    try {
      await fs.access(candidate);
      return candidate;
    } catch {
      // Continue through the platform candidates.
    }
  }
  return undefined;
}
