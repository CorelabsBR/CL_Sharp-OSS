"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.readGitStatus = readGitStatus;
exports.discoverRepositories = discoverRepositories;
exports.readStatus = readStatus;
exports.runGit = runGit;
exports.stage = stage;
exports.unstage = unstage;
exports.discard = discard;
exports.commit = commit;
exports.checkout = checkout;
exports.createBranch = createBranch;
exports.gitDiff = gitDiff;
exports.gitHistory = gitHistory;
const promises_1 = __importDefault(require("node:fs/promises"));
const node_path_1 = __importDefault(require("node:path"));
const processService_1 = require("./processService");
const GIT_TIMEOUT_MS = 45000;
async function readGitStatus(workspace) {
    const repos = await discoverRepositories(workspace);
    const statuses = await Promise.all(repos.map(readStatus));
    return statuses.sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: "base" }));
}
async function discoverRepositories(workspace) {
    if (!workspace)
        return [];
    const root = node_path_1.default.resolve(workspace);
    const repos = new Set();
    try {
        const stat = await promises_1.default.stat(root);
        if (!stat.isDirectory())
            return [];
    }
    catch {
        return [];
    }
    if (await exists(node_path_1.default.join(root, ".git"))) {
        repos.add(root);
    }
    await walkDirs(root, 5, async (dir) => {
        if (dir === root)
            return true;
        const relative = node_path_1.default.relative(root, dir).replace(/\\/g, "/");
        if (relative.includes("/.git") ||
            relative.startsWith(".git") ||
            relative.includes("/target/") ||
            relative.includes("/build/") ||
            relative.includes("/node_modules/")) {
            return false;
        }
        if (await exists(node_path_1.default.join(dir, ".git"))) {
            repos.add(dir);
            return false;
        }
        return true;
    });
    return [...repos];
}
async function readStatus(repo) {
    const branchResult = await runGit(repo, ["branch", "--show-current"]);
    const statusResult = await runGit(repo, ["status", "--porcelain=v1", "-b", "--ignored"]);
    const branchesResult = await runGit(repo, ["branch", "--format=%(refname:short)"]);
    let branch = branchResult.output.trim();
    if (!branch)
        branch = "detached";
    let ahead = 0;
    let behind = 0;
    const files = [];
    if (statusResult.success) {
        for (const line of statusResult.output.split(/\r?\n/)) {
            if (line.startsWith("##")) {
                const counts = parseAheadBehind(line);
                ahead = counts[0];
                behind = counts[1];
            }
            else if (line.trim()) {
                files.push(parseStatusLine(repo, line));
            }
        }
    }
    const branches = branchesResult.success
        ? branchesResult.output.split(/\r?\n/).map(item => item.trim()).filter(Boolean)
        : [];
    return { repo, name: node_path_1.default.basename(repo), branch, ahead, behind, files, branches, clean: files.every(file => file.ignored) };
}
async function runGit(repo, args) {
    const result = await (0, processService_1.runProcess)("git", args, { cwd: repo, timeoutMs: GIT_TIMEOUT_MS });
    return { success: result.code === 0, output: result.output.trim() };
}
async function stage(repo, file) {
    return runGit(repo, ["add", "--", file.path]);
}
async function unstage(repo, file) {
    return runGit(repo, ["restore", "--staged", "--", file.path]);
}
async function discard(repo, file) {
    if (file.kind === "untracked" || file.kind === "ignored") {
        return runGit(repo, ["clean", "-f", "--", file.path]);
    }
    return runGit(repo, ["restore", "--worktree", "--", file.path]);
}
async function commit(repo, message, allowEmpty = false) {
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
async function checkout(repo, branch) {
    const status = await readStatus(repo);
    if (!status.clean) {
        return { success: false, output: "Checkout bloqueado: ha alteracoes locais. Faça commit, stage/stash ou descarte antes." };
    }
    return runGit(repo, ["checkout", branch]);
}
async function createBranch(repo, branch) {
    if (!branch?.trim()) {
        return { success: false, output: "Nome de branch vazio." };
    }
    return runGit(repo, ["checkout", "-b", branch.trim()]);
}
async function gitDiff(repo, file, staged) {
    if (file.kind === "untracked" && !staged) {
        try {
            return await promises_1.default.readFile(node_path_1.default.join(repo, file.path), "utf8");
        }
        catch (error) {
            return `Arquivo novo nao pode ser lido: ${error instanceof Error ? error.message : String(error)}`;
        }
    }
    const args = ["diff"];
    if (staged)
        args.push("--cached");
    args.push("--");
    if (file.oldPath)
        args.push(file.oldPath);
    args.push(file.path);
    return (await runGit(repo, args)).output;
}
async function gitHistory(repo) {
    const result = await runGit(repo, ["log", "--max-count=80", "--date=short", "--pretty=format:%H%x1f%an%x1f%ad%x1f%s%x1f%b%x1e"]);
    if (!result.success)
        return [];
    const commits = [];
    for (const entry of result.output.split("\u001e")) {
        const parts = entry.trim().split("\u001f", 5);
        if (parts.length >= 4) {
            commits.push({ hash: parts[0], author: parts[1], date: parts[2], subject: parts[3], body: parts[4] ?? "" });
        }
    }
    return commits;
}
function parseStatusLine(repo, line) {
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
    let kind;
    if (conflicted)
        kind = "conflicted";
    else if (ignored)
        kind = "ignored";
    else if (untracked)
        kind = "untracked";
    else if (x === "R" || y === "R")
        kind = "renamed";
    else if (x === "A" || y === "A")
        kind = "added";
    else if (x === "D" || y === "D")
        kind = "deleted";
    else
        kind = "modified";
    return {
        repositoryName: node_path_1.default.basename(repo),
        repo,
        path: filePath,
        oldPath,
        absolutePath: node_path_1.default.join(repo, filePath),
        kind,
        staged,
        conflicted,
        ignored,
        x,
        y
    };
}
function isConflict(x, y) {
    const xy = `${x}${y}`.toUpperCase();
    return xy.includes("U") || xy === "AA" || xy === "DD";
}
function parseAheadBehind(line) {
    return [parseBracketNumber(line, "ahead "), parseBracketNumber(line, "behind ")];
}
function parseBracketNumber(line, marker) {
    const idx = line.indexOf(marker);
    if (idx < 0)
        return 0;
    let end = idx + marker.length;
    while (end < line.length && /\d/.test(line[end]))
        end++;
    const parsed = Number.parseInt(line.slice(idx + marker.length, end), 10);
    return Number.isNaN(parsed) ? 0 : parsed;
}
async function walkDirs(root, depth, onDir) {
    if (depth < 0)
        return;
    let entries;
    try {
        entries = await promises_1.default.readdir(root, { withFileTypes: true });
    }
    catch {
        return;
    }
    for (const entry of entries) {
        if (!entry.isDirectory())
            continue;
        const dir = node_path_1.default.join(root, entry.name);
        if (await onDir(dir)) {
            await walkDirs(dir, depth - 1, onDir);
        }
    }
}
async function exists(target) {
    try {
        await promises_1.default.access(target);
        return true;
    }
    catch {
        return false;
    }
}
//# sourceMappingURL=gitService.js.map