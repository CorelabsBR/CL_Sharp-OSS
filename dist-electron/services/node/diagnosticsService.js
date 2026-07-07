"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.runJavaDiagnostics = runJavaDiagnostics;
const promises_1 = __importDefault(require("node:fs/promises"));
const node_path_1 = __importDefault(require("node:path"));
const processService_1 = require("./processService");
async function runJavaDiagnostics(workspace, filePath) {
    if (!workspace)
        return [];
    const projectRoot = await findMavenProjectRoot(workspace, filePath);
    if (!projectRoot)
        return [];
    const diagnostics = [];
    const mvn = process.platform === "win32" ? "mvn.cmd" : "mvn";
    const result = await (0, processService_1.runProcess)(mvn, ["-q", "-DskipTests", "compile"], { cwd: projectRoot, timeoutMs: 120000 });
    const output = result.output;
    for (const line of output.split(/\r?\n/)) {
        const diagnostic = parseMavenLine(line, projectRoot);
        if (diagnostic && (!filePath || node_path_1.default.resolve(diagnostic.filePath) === node_path_1.default.resolve(filePath))) {
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
async function findMavenProjectRoot(workspace, filePath) {
    const workspaceRoot = node_path_1.default.resolve(workspace);
    let current = filePath ? node_path_1.default.dirname(node_path_1.default.resolve(filePath)) : workspaceRoot;
    while (isInsideOrSame(current, workspaceRoot)) {
        if (await fileExists(node_path_1.default.join(current, "pom.xml")))
            return current;
        const parent = node_path_1.default.dirname(current);
        if (parent === current)
            break;
        current = parent;
    }
    return undefined;
}
async function fileExists(filePath) {
    try {
        await promises_1.default.access(filePath);
        return true;
    }
    catch {
        return false;
    }
}
function isInsideOrSame(child, parent) {
    const relative = node_path_1.default.relative(parent, child);
    return relative === "" || (!relative.startsWith("..") && !node_path_1.default.isAbsolute(relative));
}
function parseMavenLine(line, workspace) {
    const javac = line.match(/\[ERROR\]\s+(.+\.java):\[(\d+),(\d+)\]\s+(.+)/);
    if (javac) {
        return {
            filePath: node_path_1.default.isAbsolute(javac[1]) ? javac[1] : node_path_1.default.join(workspace, javac[1]),
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
            filePath: node_path_1.default.isAbsolute(warning[1]) ? warning[1] : node_path_1.default.join(workspace, warning[1]),
            line: Number(warning[2]),
            column: Number(warning[3]),
            message: warning[4],
            severity: "WARNING",
            source: "javac"
        };
    }
    return undefined;
}
//# sourceMappingURL=diagnosticsService.js.map