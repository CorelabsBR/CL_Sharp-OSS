"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.listDir = listDir;
exports.readFile = readFile;
exports.writeFile = writeFile;
exports.createFile = createFile;
exports.createFolder = createFolder;
exports.renamePath = renamePath;
exports.deletePath = deletePath;
exports.revealPath = revealPath;
exports.exists = exists;
const electron_1 = require("electron");
const promises_1 = __importDefault(require("node:fs/promises"));
const node_path_1 = __importDefault(require("node:path"));
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
async function listDir(targetPath) {
    const entries = await promises_1.default.readdir(targetPath, { withFileTypes: true });
    const result = [];
    for (const entry of entries) {
        if (entry.isDirectory() && IGNORED_DIRECTORY_NAMES.has(entry.name.toLowerCase())) {
            continue;
        }
        const fullPath = node_path_1.default.join(targetPath, entry.name);
        let stat;
        try {
            stat = await promises_1.default.stat(fullPath);
        }
        catch {
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
        if (a.directory !== b.directory)
            return a.directory ? -1 : 1;
        return a.name.localeCompare(b.name, undefined, { sensitivity: "base" });
    });
}
async function readFile(targetPath) {
    const content = await promises_1.default.readFile(targetPath, "utf8");
    return {
        path: targetPath,
        name: node_path_1.default.basename(targetPath),
        content,
        lineEnding: content.includes("\r\n") ? "\r\n" : "\n",
        encoding: "utf8"
    };
}
async function writeFile(targetPath, content) {
    await promises_1.default.mkdir(node_path_1.default.dirname(targetPath), { recursive: true });
    await promises_1.default.writeFile(targetPath, content ?? "", "utf8");
}
async function createFile(targetPath) {
    await promises_1.default.mkdir(node_path_1.default.dirname(targetPath), { recursive: true });
    try {
        await promises_1.default.writeFile(targetPath, "", { flag: "wx" });
    }
    catch (error) {
        if (error.code !== "EEXIST")
            throw error;
    }
}
async function createFolder(targetPath) {
    await promises_1.default.mkdir(targetPath, { recursive: true });
}
async function renamePath(oldPath, newPath) {
    await promises_1.default.rename(oldPath, newPath);
}
async function deletePath(targetPath) {
    await promises_1.default.rm(targetPath, { recursive: true, force: true });
}
async function revealPath(targetPath) {
    await electron_1.shell.showItemInFolder(targetPath);
}
async function exists(targetPath) {
    try {
        await promises_1.default.access(targetPath);
        return true;
    }
    catch {
        return false;
    }
}
//# sourceMappingURL=fileSystemService.js.map