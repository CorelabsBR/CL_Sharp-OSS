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
        output: `[DEBUG] Runtime selecionado: ${language.displayName}\n${result.output}\n[DEBUG] Processo finalizado com codigo ${result.code ?? 1}`.trim(),
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