"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.listRuntimes = listRuntimes;
exports.discoverRuntimes = discoverRuntimes;
exports.configureRuntime = configureRuntime;
exports.runFile = runFile;
const promises_1 = __importDefault(require("node:fs/promises"));
const node_crypto_1 = require("node:crypto");
const node_os_1 = __importDefault(require("node:os"));
const node_path_1 = __importDefault(require("node:path"));
const interpreter_1 = require("../../core/portugol/interpreter");
const languages_1 = require("../../core/runtime/languages");
const processService_1 = require("./processService");
const paths_1 = require("./paths");
async function listRuntimes() {
    return discoverRuntimes(false);
}
async function discoverRuntimes(rescan = true) {
    const configured = await loadRegistry();
    const installed = [];
    for (const language of languages_1.LANGUAGE_RUNTIMES) {
        if (language.id === "portugol") {
            installed.push({ language, rootPath: (0, paths_1.toolBinDir)(), executablePath: node_path_1.default.join((0, paths_1.toolBinDir)(), "internal-portugol"), debuggerPath: node_path_1.default.join((0, paths_1.toolBinDir)(), "internal-portugol"), version: "npsharp", source: "internal" });
            continue;
        }
        const configuredRuntime = configured.get(language.id);
        if (configuredRuntime) {
            installed.push({ ...configuredRuntime, language, source: "configured" });
            continue;
        }
        if (!rescan)
            continue;
        for (const candidate of language.executableCandidates) {
            const executable = await (0, processService_1.commandExists)(candidate);
            if (executable) {
                installed.push({
                    language,
                    rootPath: node_path_1.default.dirname(executable),
                    executablePath: executable,
                    version: await readVersion(executable),
                    source: "system"
                });
                break;
            }
        }
    }
    await saveRegistryFromInstalled(installed);
    return installed;
}
async function configureRuntime(languageId, executablePath) {
    const current = await loadRegistry();
    const language = languages_1.LANGUAGE_RUNTIMES.find(item => item.id === languageId);
    if (language && executablePath) {
        current.set(languageId, {
            language,
            rootPath: node_path_1.default.dirname(executablePath),
            executablePath,
            version: "configured",
            source: "configured"
        });
    }
    await saveRegistryMap(current);
    return discoverRuntimes(true);
}
async function runFile(request) {
    const language = (0, languages_1.languageFromFileName)(node_path_1.default.basename(request.filePath));
    if (!language || language.id === "git") {
        return { output: `[ERRO] Linguagem nao reconhecida para ${node_path_1.default.basename(request.filePath)}`, code: 1 };
    }
    const source = request.content ?? await promises_1.default.readFile(request.filePath, "utf8");
    if (language.id === "portugol") {
        const output = [];
        const interpreter = new interpreter_1.PortugolInterpreter();
        interpreter.executeWithOutput(source, line => output.push(`[PORTUGOL] ${line}`));
        return {
            language: language.displayName,
            output: [`[DEBUG] Runtime Portugol selecionado`, ...output, "[DEBUG] Execucao finalizada"].join("\n"),
            code: output.some(line => line.includes("[ERRO]")) ? 1 : 0
        };
    }
    const runtimes = await discoverRuntimes(true);
    const runtime = runtimes.find(item => item.language.id === language.id);
    if (language.id === "node") {
        return runNodeLikeFile(language.displayName, request.filePath, runtime);
    }
    if (language.id === "java") {
        return runJavaSource(language.displayName, request.filePath, source);
    }
    if (language.id === "rust") {
        return runRustFile(language.displayName, request.filePath);
    }
    if (!runtime) {
        return {
            language: language.displayName,
            output: `[ERRO] Runtime nao encontrado: ${language.displayName}. Configure o caminho em Run and Debug.`,
            code: 127
        };
    }
    const command = buildRunCommand(language.id, runtime.executablePath, request.filePath);
    const result = await (0, processService_1.runProcess)(command[0], command.slice(1), {
        cwd: node_path_1.default.dirname(request.filePath),
        timeoutMs: 120000,
        env: { NPSHARP_RUNTIME_HOME: runtime.rootPath, PATH: `${(0, paths_1.toolBinDir)()}${node_path_1.default.delimiter}${process.env.PATH ?? ""}` }
    });
    return {
        language: language.displayName,
        output: formatRunOutput(language.displayName, command, result.output, result.code),
        code: result.code ?? 1
    };
}
async function runNodeLikeFile(displayName, filePath, runtime) {
    const extension = node_path_1.default.extname(filePath).toLowerCase();
    let command;
    if (extension === ".ts" || extension === ".tsx") {
        const tsNode = await (0, processService_1.commandExists)("ts-node");
        const tsx = await (0, processService_1.commandExists)("tsx");
        if (tsNode)
            command = [tsNode, filePath];
        else if (tsx)
            command = [tsx, filePath];
    }
    else if (runtime) {
        command = [runtime.executablePath, filePath];
    }
    if (!command) {
        return {
            language: displayName,
            output: extension === ".ts" || extension === ".tsx"
                ? "[ERRO] Runtime TypeScript nao encontrado. Instale/configure tsx ou ts-node em Run and Debug."
                : "[ERRO] Runtime Node.js nao encontrado. Configure o caminho em Run and Debug.",
            code: 127
        };
    }
    const result = await (0, processService_1.runProcess)(command[0], command.slice(1), { cwd: node_path_1.default.dirname(filePath), timeoutMs: 120000 });
    return {
        language: displayName,
        output: formatRunOutput(displayName, command, result.output, result.code),
        code: result.code ?? 1
    };
}
async function runJavaSource(displayName, filePath, source) {
    const java = await (0, processService_1.commandExists)("java");
    if (!java) {
        return { language: displayName, output: "[ERRO] Runtime Java nao encontrado. Configure java em Run and Debug.", code: 127 };
    }
    const javac = await (0, processService_1.commandExists)("javac");
    if (!javac) {
        const command = [java, filePath];
        const result = await (0, processService_1.runProcess)(command[0], command.slice(1), { cwd: node_path_1.default.dirname(filePath), timeoutMs: 120000 });
        return {
            language: displayName,
            output: formatRunOutput(displayName, command, result.output, result.code),
            code: result.code ?? 1
        };
    }
    const buildDir = node_path_1.default.join(node_os_1.default.tmpdir(), "npsharp-java", (0, node_crypto_1.createHash)("sha1").update(filePath).digest("hex"));
    await promises_1.default.rm(buildDir, { recursive: true, force: true });
    await promises_1.default.mkdir(buildDir, { recursive: true });
    const compileCommand = [javac, "-d", buildDir, filePath];
    const compile = await (0, processService_1.runProcess)(compileCommand[0], compileCommand.slice(1), { cwd: node_path_1.default.dirname(filePath), timeoutMs: 120000 });
    if ((compile.code ?? 1) !== 0) {
        return {
            language: displayName,
            output: formatRunOutput(`${displayName} compile`, compileCommand, compile.output, compile.code),
            code: compile.code ?? 1
        };
    }
    const className = mainClassName(filePath, source);
    const runCommand = [java, "-cp", buildDir, className];
    const result = await (0, processService_1.runProcess)(runCommand[0], runCommand.slice(1), { cwd: node_path_1.default.dirname(filePath), timeoutMs: 120000 });
    const compileOutput = formatRunOutput(`${displayName} compile`, compileCommand, compile.output || "Compilacao concluida.", compile.code);
    const runOutput = formatRunOutput(displayName, runCommand, result.output, result.code);
    return {
        language: displayName,
        output: `${compileOutput}\n\n${runOutput}`.trim(),
        code: result.code ?? 1
    };
}
async function runRustFile(displayName, filePath) {
    const cargoRoot = await findUp(node_path_1.default.dirname(filePath), "Cargo.toml");
    if (cargoRoot) {
        const cargo = await (0, processService_1.commandExists)("cargo");
        if (!cargo) {
            return { language: displayName, output: "[ERRO] Cargo nao encontrado para executar este projeto Rust.", code: 127 };
        }
        const command = [cargo, "run"];
        const result = await (0, processService_1.runProcess)(command[0], command.slice(1), { cwd: cargoRoot, timeoutMs: 120000 });
        return {
            language: displayName,
            output: formatRunOutput(displayName, command, result.output, result.code),
            code: result.code ?? 1
        };
    }
    const rustc = await (0, processService_1.commandExists)("rustc");
    if (!rustc) {
        return { language: displayName, output: "[ERRO] rustc nao encontrado para executar este arquivo Rust.", code: 127 };
    }
    const buildDir = node_path_1.default.join(node_os_1.default.tmpdir(), "npsharp-rust", (0, node_crypto_1.createHash)("sha1").update(filePath).digest("hex"));
    await promises_1.default.rm(buildDir, { recursive: true, force: true });
    await promises_1.default.mkdir(buildDir, { recursive: true });
    const binary = node_path_1.default.join(buildDir, process.platform === "win32" ? "main.exe" : "main");
    const compileCommand = [rustc, filePath, "-o", binary];
    const compile = await (0, processService_1.runProcess)(compileCommand[0], compileCommand.slice(1), { cwd: node_path_1.default.dirname(filePath), timeoutMs: 120000 });
    if ((compile.code ?? 1) !== 0) {
        return {
            language: displayName,
            output: formatRunOutput(`${displayName} compile`, compileCommand, compile.output, compile.code),
            code: compile.code ?? 1
        };
    }
    const command = [binary];
    const result = await (0, processService_1.runProcess)(command[0], command.slice(1), { cwd: node_path_1.default.dirname(filePath), timeoutMs: 120000 });
    return {
        language: displayName,
        output: `${formatRunOutput(`${displayName} compile`, compileCommand, compile.output || "Compilacao concluida.", compile.code)}\n\n${formatRunOutput(displayName, command, result.output, result.code)}`.trim(),
        code: result.code ?? 1
    };
}
function buildRunCommand(languageId, executable, filePath) {
    switch (languageId) {
        case "powershell":
            return [executable, "-ExecutionPolicy", "Bypass", "-File", filePath];
        case "go":
            return [executable, "run", filePath];
        case "csharp":
            return [executable, "run", "--project", node_path_1.default.dirname(filePath)];
        case "kotlin":
            return [executable, "-script", filePath];
        default:
            return [executable, filePath];
    }
}
function mainClassName(filePath, source) {
    const packageMatch = source.match(/^\s*package\s+([A-Za-z_$][\w$]*(?:\.[A-Za-z_$][\w$]*)*)\s*;/m);
    const className = node_path_1.default.basename(filePath, ".java");
    return packageMatch ? `${packageMatch[1]}.${className}` : className;
}
async function findUp(startDir, fileName) {
    let current = node_path_1.default.resolve(startDir);
    while (true) {
        try {
            await promises_1.default.access(node_path_1.default.join(current, fileName));
            return current;
        }
        catch {
            const parent = node_path_1.default.dirname(current);
            if (parent === current)
                return undefined;
            current = parent;
        }
    }
}
function formatRunOutput(displayName, command, output, code) {
    return [
        `[DEBUG] Runtime selecionado: ${displayName}`,
        `[DEBUG] Comando: ${formatCommand(command)}`,
        output,
        `[DEBUG] Processo finalizado com codigo ${code ?? 1}`
    ].filter(Boolean).join("\n").trim();
}
function formatCommand(command) {
    return command.map(part => /\s/.test(part) ? `"${part.replace(/"/g, "\\\"")}"` : part).join(" ");
}
async function readVersion(executable) {
    const result = await (0, processService_1.runProcess)(executable, ["--version"], { timeoutMs: 5000 });
    return result.output.split(/\r?\n/).find(Boolean)?.trim() || "detected";
}
async function loadRegistry() {
    const map = new Map();
    try {
        const raw = await promises_1.default.readFile((0, paths_1.runtimeRegistryPath)(), "utf8");
        const props = parseProperties(raw);
        for (const language of languages_1.LANGUAGE_RUNTIMES) {
            const root = props.get(`${language.id}.root`);
            const exe = props.get(`${language.id}.exe`);
            if (!root || !exe)
                continue;
            const debuggerPath = props.get(`${language.id}.debugger`);
            map.set(language.id, {
                language,
                rootPath: root,
                executablePath: exe,
                debuggerPath: debuggerPath || undefined,
                version: props.get(`${language.id}.version`) ?? "unknown",
                source: "configured"
            });
        }
    }
    catch {
        // registry is optional
    }
    return map;
}
async function saveRegistryFromInstalled(installed) {
    const map = new Map();
    for (const runtime of installed) {
        map.set(runtime.language.id, runtime);
    }
    await saveRegistryMap(map);
}
async function saveRegistryMap(installed) {
    await promises_1.default.mkdir(node_path_1.default.dirname((0, paths_1.runtimeRegistryPath)()), { recursive: true });
    const lines = ["# NPSharp Runtime Registry"];
    for (const runtime of installed.values()) {
        lines.push(`${runtime.language.id}.root=${runtime.rootPath}`);
        lines.push(`${runtime.language.id}.exe=${runtime.executablePath}`);
        if (runtime.debuggerPath)
            lines.push(`${runtime.language.id}.debugger=${runtime.debuggerPath}`);
        lines.push(`${runtime.language.id}.version=${runtime.version}`);
        lines.push("");
    }
    await promises_1.default.writeFile((0, paths_1.runtimeRegistryPath)(), lines.join("\n"), "utf8");
}
function parseProperties(raw) {
    const props = new Map();
    for (const line of raw.split(/\r?\n/)) {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith("#"))
            continue;
        const equals = trimmed.indexOf("=");
        if (equals < 0)
            continue;
        props.set(trimmed.slice(0, equals).trim(), trimmed.slice(equals + 1).trim());
    }
    return props;
}
//# sourceMappingURL=runtimeService.js.map