"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.normalizeCwd = normalizeCwd;
exports.runShell = runShell;
exports.runProcess = runProcess;
exports.commandExists = commandExists;
const node_child_process_1 = require("node:child_process");
const promises_1 = __importDefault(require("node:fs/promises"));
const node_os_1 = __importDefault(require("node:os"));
const node_path_1 = __importDefault(require("node:path"));
function normalizeCwd(cwd) {
    if (!cwd || cwd.trim() === "") {
        return node_os_1.default.homedir();
    }
    return node_path_1.default.resolve(cwd);
}
function runShell(command, cwd, configuredShell) {
    const shell = configuredShell?.trim() || defaultShell();
    const normalizedCwd = normalizeCwd(cwd);
    const args = process.platform === "win32" ? windowsShellArgs(shell, command) : ["-lc", command];
    return runProcess(shell, args, { cwd: normalizedCwd, timeoutMs: 120000 }).then(result => ({
        cwd: normalizedCwd,
        output: result.output,
        code: result.code
    }));
}
function runProcess(executable, args, options = {}) {
    return new Promise(resolve => {
        const child = (0, node_child_process_1.spawn)(executable, args, {
            cwd: options.cwd,
            env: { ...process.env, ...options.env },
            shell: false,
            windowsHide: true
        });
        let output = "";
        const timeout = options.timeoutMs
            ? setTimeout(() => {
                output += "\n[ERRO] Processo excedeu o tempo limite.";
                child.kill("SIGKILL");
            }, options.timeoutMs)
            : undefined;
        child.stdout.on("data", chunk => {
            output += chunk.toString();
        });
        child.stderr.on("data", chunk => {
            output += chunk.toString();
        });
        child.on("error", error => {
            if (timeout)
                clearTimeout(timeout);
            resolve({ output: error.message, code: 1 });
        });
        child.on("close", code => {
            if (timeout)
                clearTimeout(timeout);
            resolve({ output: output.trimEnd(), code });
        });
    });
}
async function commandExists(command) {
    if (command.includes(node_path_1.default.sep) || command.includes("/")) {
        try {
            await promises_1.default.access(command);
            return node_path_1.default.resolve(command);
        }
        catch {
            return undefined;
        }
    }
    const pathValue = process.env.PATH ?? "";
    const extensions = process.platform === "win32" ? ["", ".exe", ".cmd", ".bat"] : [""];
    for (const dir of pathValue.split(node_path_1.default.delimiter)) {
        if (!dir)
            continue;
        for (const ext of extensions) {
            const candidate = node_path_1.default.join(dir, command + ext);
            try {
                await promises_1.default.access(candidate);
                return candidate;
            }
            catch {
                // keep scanning PATH
            }
        }
    }
    return undefined;
}
function defaultShell() {
    if (process.platform === "win32") {
        return process.env.ComSpec || "powershell.exe";
    }
    return process.env.SHELL || "/bin/bash";
}
function windowsShellArgs(shell, command) {
    const name = node_path_1.default.basename(shell).toLowerCase();
    if (name === "cmd.exe" || name === "cmd") {
        return ["/D", "/Q", "/C", normalizeCmdCommand(command)];
    }
    if (name === "bash.exe" || name === "bash") {
        return ["-lc", command];
    }
    return ["-NoLogo", "-Command", command];
}
function normalizeCmdCommand(command) {
    const trimmed = command.trim();
    const lower = trimmed.toLowerCase();
    if (lower === "pwd")
        return "cd";
    if (lower === "ls")
        return "dir";
    if (lower.startsWith("ls "))
        return `dir ${trimmed.slice(3)}`;
    if (lower === "clear")
        return "cls";
    return command;
}
//# sourceMappingURL=processService.js.map