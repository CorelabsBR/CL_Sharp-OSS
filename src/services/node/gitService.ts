/*---------------------------------------------------------------------------------------------
- Copyright (c) CorelabsBR. All rights reserved.
- Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
import fs from "node:fs/promises";
import path from "node:path";
import type { GitCommit, GitDiffContent, GitFileStatus, GitOperationResult, GitRepositoryStatus, GitStatusKind } from "../../shared/types";
import { runProcess } from "./processService";

const GIT_TIMEOUT_MS = 45000;

export async function readGitStatus(workspace: string): Promise<GitRepositoryStatus[]> {
  const repos = await discoverRepositories(workspace);
  const statuses = await Promise.all(repos.map(readStatus));
  return statuses.sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: "base" }));
}

export async function discoverRepositories(workspace: string): Promise<string[]> {
  if (!workspace) return [];
  const root = path.resolve(workspace);
  const repos = new Set<string>();

  try {
    const stat = await fs.stat(root);
    if (!stat.isDirectory()) return [];
  } catch {
    return [];
  }

  if (await exists(path.join(root, ".git"))) {
    repos.add(root);
  }

  await walkDirs(root, 5, async dir => {
    if (dir === root) return true;
    const relative = path.relative(root, dir).replace(/\\/g, "/");
    if (
      relative.includes("/.git") ||
      relative.startsWith(".git") ||
      relative.includes("/target/") ||
      relative.includes("/build/") ||
      relative.includes("/node_modules/")
    ) {
      return false;
    }
    if (await exists(path.join(dir, ".git"))) {
      repos.add(dir);
      return false;
    }
    return true;
  });

  return [...repos];
}

export async function readStatus(repo: string): Promise<GitRepositoryStatus> {
  const branchResult = await runGit(repo, ["branch", "--show-current"]);
  const statusResult = await runGit(repo, ["status", "--porcelain=v1", "-b", "--ignored"]);
  const branchesResult = await runGit(repo, ["branch", "--format=%(refname:short)"]);

  let branch = branchResult.output.trim();
  if (!branch) branch = "detached";
  let ahead = 0;
  let behind = 0;
  const files: GitFileStatus[] = [];

  if (statusResult.success) {
    for (const line of statusResult.output.split(/\r?\n/)) {
      if (line.startsWith("##")) {
        const counts = parseAheadBehind(line);
        ahead = counts[0];
        behind = counts[1];
      } else if (line.trim()) {
        files.push(...parseStatusLines(repo, line));
      }
    }
  }

  const branches = branchesResult.success
    ? branchesResult.output.split(/\r?\n/).map(item => item.trim()).filter(Boolean)
    : [];

  return { repo, name: path.basename(repo), branch, ahead, behind, files, branches, clean: files.every(file => file.ignored) };
}

export async function runGit(repo: string, args: string[]): Promise<GitOperationResult> {
  const result = await runProcess("git", args, { cwd: repo, timeoutMs: GIT_TIMEOUT_MS });
  return { success: result.code === 0, output: result.output.trim() };
}

export async function stage(repo: string, file: GitFileStatus): Promise<GitOperationResult> {
  return runGit(repo, ["add", "--", file.path]);
}

export async function unstage(repo: string, file: GitFileStatus): Promise<GitOperationResult> {
  return runGit(repo, ["restore", "--staged", "--", file.path]);
}

export async function discard(repo: string, file: GitFileStatus): Promise<GitOperationResult> {
  if (file.kind === "untracked" || file.kind === "ignored") {
    return runGit(repo, ["clean", "-f", "--", file.path]);
  }
  return runGit(repo, ["restore", "--worktree", "--", file.path]);
}

export async function commit(repo: string, message: string, allowEmpty = false): Promise<GitOperationResult> {
  if (!message?.trim()) {
    return { success: false, output: "Informe uma mensagem de commit." };
  }
  if (allowEmpty) {
    return runGit(repo, ["commit", "--allow-empty", "-m", message.trim()]);
  }
  const staged = await runGit(repo, ["diff", "--cached", "--quiet"]);
  if (staged.success) {
    return { success: false, output: "Nao ha alteracoes em stage para commit." };
  }
  return runGit(repo, ["commit", "-m", message.trim()]);
}

export async function checkout(repo: string, branch: string): Promise<GitOperationResult> {
  const status = await readStatus(repo);
  if (!status.clean) {
    return { success: false, output: "Checkout bloqueado: ha alteracoes locais. Faça commit, stage/stash ou descarte antes." };
  }
  return runGit(repo, ["checkout", branch]);
}

export async function createBranch(repo: string, branch: string): Promise<GitOperationResult> {
  if (!branch?.trim()) {
    return { success: false, output: "Nome de branch vazio." };
  }
  return runGit(repo, ["checkout", "-b", branch.trim()]);
}

export async function gitDiff(repo: string, file: GitFileStatus, staged: boolean): Promise<string> {
  if (file.kind === "untracked" && !staged) {
    try {
      return await fs.readFile(path.join(repo, file.path), "utf8");
    } catch (error) {
      return `Arquivo novo nao pode ser lido: ${error instanceof Error ? error.message : String(error)}`;
    }
  }
  const args = ["diff"];
  if (staged) args.push("--cached");
  args.push("--");
  if (file.oldPath) args.push(file.oldPath);
  args.push(file.path);
  return (await runGit(repo, args)).output;
}

export async function gitDiffContent(repo: string, file: GitFileStatus, staged: boolean): Promise<GitDiffContent> {
  const filePath = file.path;
  const originalPath = file.oldPath || filePath;
  const head = await readGitObject(repo, `HEAD:${originalPath}`);
  const index = await readGitObject(repo, `:${filePath}`);
  const working = await readWorkingFile(repo, filePath);
  return {
    original: staged ? head : (index || head),
    modified: staged ? index : working,
    originalLabel: staged ? `HEAD — ${originalPath}` : `INDEX — ${filePath}`,
    modifiedLabel: staged ? `STAGED — ${filePath}` : `WORKING TREE — ${filePath}`,
    language: path.extname(filePath).slice(1) || "plaintext"
  };
}

async function readGitObject(repo: string, object: string): Promise<string> {
  const result = await runGit(repo, ["show", object]);
  return result.success ? result.output : "";
}

async function readWorkingFile(repo: string, file: string): Promise<string> {
  try {
    return await fs.readFile(path.join(repo, file), "utf8");
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return "";
    throw error;
  }
}

export async function gitHistory(repo: string): Promise<GitCommit[]> {
  const result = await runGit(repo, ["log", "--max-count=80", "--date=short", "--pretty=format:%H%x1f%an%x1f%ad%x1f%s%x1f%b%x1e"]);
  if (!result.success) return [];
  const commits: GitCommit[] = [];
  for (const entry of result.output.split("\u001e")) {
    const parts = entry.trim().split("\u001f", 5);
    if (parts.length >= 4) {
      commits.push({ hash: parts[0], author: parts[1], date: parts[2], subject: parts[3], body: parts[4] ?? "" });
    }
  }
  return commits;
}

export function parseStatusLines(repo: string, line: string): GitFileStatus[] {
  const xy = line.length >= 2 ? line.slice(0, 2) : "??";
  const pathPart = line.length > 3 ? line.slice(3).trim() : "";
  let oldPath = "";
  let filePath = pathPart;
  if (pathPart.includes(" -> ")) {
    const parts = pathPart.split(" -> ", 2);
    oldPath = parts[0];
    filePath = parts[1];
  }

  const x = xy.charAt(0);
  const y = xy.charAt(1);
  const ignored = x === "!" && y === "!";
  const untracked = x === "?" && y === "?";
  const conflicted = isConflict(x, y);
  const staged = x !== " " && x !== "?" && x !== "!";
  let kind: GitStatusKind;
  if (conflicted) kind = "conflicted";
  else if (ignored) kind = "ignored";
  else if (untracked) kind = "untracked";
  else if (x === "R" || y === "R") kind = "renamed";
  else if (x === "A" || y === "A") kind = "added";
  else if (x === "D" || y === "D") kind = "deleted";
  else kind = "modified";

  const base = {
    repositoryName: path.basename(repo),
    repo,
    path: filePath,
    oldPath,
    absolutePath: path.join(repo, filePath),
    kind,
    staged,
    conflicted,
    ignored,
    x,
    y
  } satisfies GitFileStatus;
  if (conflicted || ignored || untracked || x === " " || y === " ") return [base];
  const stagedKind = kindForStatus(x, false);
  const workingKind = kindForStatus(y, false);
  return [
    { ...base, kind: stagedKind, staged: true },
    { ...base, kind: workingKind, staged: false }
  ];
}

function kindForStatus(status: string, conflict: boolean): GitStatusKind {
  if (conflict || status === "U") return "conflicted";
  if (status === "A") return "added";
  if (status === "D") return "deleted";
  if (status === "R") return "renamed";
  if (status === "?") return "untracked";
  if (status === "!") return "ignored";
  return "modified";
}

function isConflict(x: string, y: string): boolean {
  const xy = `${x}${y}`.toUpperCase();
  return xy.includes("U") || xy === "AA" || xy === "DD";
}

function parseAheadBehind(line: string): [number, number] {
  return [parseBracketNumber(line, "ahead "), parseBracketNumber(line, "behind ")];
}

function parseBracketNumber(line: string, marker: string): number {
  const idx = line.indexOf(marker);
  if (idx < 0) return 0;
  let end = idx + marker.length;
  while (end < line.length && /\d/.test(line[end])) end++;
  const parsed = Number.parseInt(line.slice(idx + marker.length, end), 10);
  return Number.isNaN(parsed) ? 0 : parsed;
}

async function walkDirs(root: string, depth: number, onDir: (dir: string) => Promise<boolean>): Promise<void> {
  if (depth < 0) return;
  let entries;
  try {
    entries = await fs.readdir(root, { withFileTypes: true });
  } catch {
    return;
  }
  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    const dir = path.join(root, entry.name);
    if (await onDir(dir)) {
      await walkDirs(dir, depth - 1, onDir);
    }
  }
}

async function exists(target: string): Promise<boolean> {
  try {
    await fs.access(target);
    return true;
  } catch {
    return false;
  }
}
