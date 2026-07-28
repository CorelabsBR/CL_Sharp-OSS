/*---------------------------------------------------------------------------------------------
- Copyright (c) CorelabsBR. All rights reserved.
- Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
import fs from "node:fs/promises";
import path from "node:path";
import type { EditorDiagnostic } from "../../shared/types";
import { runProcess } from "./processService";

export async function runJavaDiagnostics(workspace: string, filePath?: string): Promise<EditorDiagnostic[]> {
  if (!workspace) return [];
  const projectRoot = await findMavenProjectRoot(workspace, filePath);
  if (!projectRoot) return [];

  const diagnostics: EditorDiagnostic[] = [];
  const mvn = process.platform === "win32" ? "mvn.cmd" : "mvn";
  const result = await runProcess(mvn, ["-q", "-DskipTests", "compile"], { cwd: projectRoot, timeoutMs: 120000 });
  const output = result.output;

  for (const line of output.split(/\r?\n/)) {
    const diagnostic = parseMavenLine(line, projectRoot);
    if (diagnostic && (!filePath || path.resolve(diagnostic.filePath) === path.resolve(filePath))) {
      diagnostics.push(diagnostic);
    }
  }

  if (diagnostics.length === 0 && result.code !== 0) {
    diagnostics.push({
      filePath: filePath || workspace,
      line: 1,
      column: 1,
      message: output.split(/\r?\n/).find(Boolean) || "Falha ao executar diagnostico Java.",
      severity: "ERROR",
      source: "maven"
    });
  }
  return diagnostics;
}

async function findMavenProjectRoot(workspace: string, filePath?: string): Promise<string | undefined> {
  const workspaceRoot = path.resolve(workspace);
  let current = filePath ? path.dirname(path.resolve(filePath)) : workspaceRoot;

  while (isInsideOrSame(current, workspaceRoot)) {
    if (await fileExists(path.join(current, "pom.xml"))) return current;
    const parent = path.dirname(current);
    if (parent === current) break;
    current = parent;
  }

  return undefined;
}

async function fileExists(filePath: string): Promise<boolean> {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

function isInsideOrSame(child: string, parent: string): boolean {
  const relative = path.relative(parent, child);
  return relative === "" || (!relative.startsWith("..") && !path.isAbsolute(relative));
}

function parseMavenLine(line: string, workspace: string): EditorDiagnostic | undefined {
  const javac = line.match(/\[ERROR\]\s+(.+\.java):\[(\d+),(\d+)\]\s+(.+)/);
  if (javac) {
    return {
      filePath: path.isAbsolute(javac[1]) ? javac[1] : path.join(workspace, javac[1]),
      line: Number(javac[2]),
      column: Number(javac[3]),
      message: javac[4],
      severity: "ERROR",
      source: "javac"
    };
  }
  const warning = line.match(/\[WARNING\]\s+(.+\.java):\[(\d+),(\d+)\]\s+(.+)/);
  if (warning) {
    return {
      filePath: path.isAbsolute(warning[1]) ? warning[1] : path.join(workspace, warning[1]),
      line: Number(warning[2]),
      column: Number(warning[3]),
      message: warning[4],
      severity: "WARNING",
      source: "javac"
    };
  }
  return undefined;
}
