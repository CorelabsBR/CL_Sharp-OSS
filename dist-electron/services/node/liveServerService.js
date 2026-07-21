"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.openLiveServer = openLiveServer;
exports.stopAllLiveServers = stopAllLiveServers;
const electron_1 = require("electron");
const promises_1 = __importDefault(require("node:fs/promises"));
const node_http_1 = __importDefault(require("node:http"));
const node_net_1 = __importDefault(require("node:net"));
const node_path_1 = __importDefault(require("node:path"));
const node_child_process_1 = require("node:child_process");
const processService_1 = require("./processService");
const HOST = "127.0.0.1";
const HTML_BASE_PORT = 5500;
const PHP_BASE_PORT = 8000;
let htmlServer;
let htmlRoot = "";
let htmlPort = -1;
let phpProcess;
let phpRoot = "";
let phpPort = -1;
async function openLiveServer(request) {
    const workspace = node_path_1.default.resolve(request.workspace);
    const filePath = node_path_1.default.resolve(request.filePath);
    const extension = node_path_1.default.extname(filePath).toLowerCase();
    if (!isPathInside(filePath, workspace)) {
        return { success: false, output: "Arquivo fora da pasta do projeto." };
    }
    if (extension === ".html" || extension === ".htm") {
        return openHtml(filePath, workspace);
    }
    if (extension === ".php") {
        return openPhp(filePath, workspace);
    }
    return { success: false, output: "Live Server suporta HTML e PHP neste momento." };
}
async function stopAllLiveServers() {
    if (htmlServer) {
        htmlServer.close();
        htmlServer = undefined;
        htmlRoot = "";
        htmlPort = -1;
    }
    if (phpProcess) {
        phpProcess.kill();
        phpProcess = undefined;
        phpRoot = "";
        phpPort = -1;
    }
    return { success: true, output: "Live Server parado" };
}
async function openHtml(filePath, workspace) {
    if (!htmlServer || htmlRoot !== workspace) {
        if (htmlServer)
            htmlServer.close();
        htmlPort = await findFreePort(HTML_BASE_PORT);
        htmlRoot = workspace;
        htmlServer = node_http_1.default.createServer((req, res) => {
            void handleStaticRequest(req.url ?? "/", htmlRoot, res);
        });
        await new Promise(resolve => htmlServer.listen(htmlPort, HOST, resolve));
    }
    const url = buildUrl(htmlPort, workspace, filePath);
    await electron_1.shell.openExternal(url);
    return { success: true, output: `Live Server HTML: ${url}`, url };
}
async function openPhp(filePath, workspace) {
    const php = await (0, processService_1.commandExists)("php");
    if (!php) {
        return { success: false, output: "PHP não encontrado no PATH. Instale PHP ou configure o caminho do executável." };
    }
    if (!phpProcess || !phpRoot || phpRoot !== workspace || phpProcess.killed) {
        if (phpProcess)
            phpProcess.kill();
        phpPort = await findFreePort(PHP_BASE_PORT);
        phpRoot = workspace;
        phpProcess = (0, node_child_process_1.spawn)(php, ["-S", `${HOST}:${phpPort}`, "-t", workspace], {
            cwd: workspace,
            shell: false,
            stdio: "ignore",
            windowsHide: true
        });
        await new Promise(resolve => setTimeout(resolve, 350));
    }
    const url = buildUrl(phpPort, workspace, filePath);
    await electron_1.shell.openExternal(url);
    return { success: true, output: `Live Server PHP: ${url}`, url };
}
async function handleStaticRequest(rawUrl, root, res) {
    try {
        const decoded = decodeURIComponent(rawUrl.split("?")[0].replace(/^\/+/, ""));
        let requested = node_path_1.default.resolve(root, decoded);
        if (!isPathInside(requested, root)) {
            send(res, 403, "Forbidden", "text/plain; charset=utf-8");
            return;
        }
        const stat = await promises_1.default.stat(requested).catch(() => undefined);
        if (stat?.isDirectory()) {
            requested = node_path_1.default.join(requested, "index.html");
        }
        const fileStat = await promises_1.default.stat(requested).catch(() => undefined);
        if (!fileStat?.isFile()) {
            send(res, 404, "Not Found", "text/plain; charset=utf-8");
            return;
        }
        const data = await promises_1.default.readFile(requested);
        res.writeHead(200, { "Content-Type": contentType(requested) });
        res.end(data);
    }
    catch (error) {
        console.warn(`[NPSharp liveServer] Failed to serve ${rawUrl}`, error);
        send(res, 500, "Internal Server Error", "text/plain; charset=utf-8");
    }
}
function send(res, code, text, contentTypeValue) {
    res.writeHead(code, { "Content-Type": contentTypeValue });
    res.end(text);
}
function buildUrl(port, root, target) {
    const relative = node_path_1.default.relative(root, target).replace(/\\/g, "/");
    return `http://${HOST}:${port}/${encodePathForUrl(relative)}`;
}
function isPathInside(candidate, root) {
    const relative = node_path_1.default.relative(root, candidate);
    return relative === "" || (!relative.startsWith("..") && !node_path_1.default.isAbsolute(relative));
}
function encodePathForUrl(value) {
    return value.split("/").map(segment => encodeURIComponent(segment)).join("/");
}
async function findFreePort(start) {
    for (let port = start; port < start + 200; port++) {
        if (await isPortFree(port))
            return port;
    }
    throw new Error(`Nenhuma porta livre encontrada a partir de ${start}`);
}
function isPortFree(port) {
    return new Promise(resolve => {
        const server = node_net_1.default.createServer();
        server.once("error", () => resolve(false));
        server.once("listening", () => {
            server.close(() => resolve(true));
        });
        server.listen(port, HOST);
    });
}
function contentType(file) {
    switch (node_path_1.default.extname(file).toLowerCase()) {
        case ".html":
        case ".htm":
            return "text/html; charset=utf-8";
        case ".css":
            return "text/css; charset=utf-8";
        case ".js":
        case ".mjs":
            return "application/javascript; charset=utf-8";
        case ".json":
            return "application/json; charset=utf-8";
        case ".svg":
            return "image/svg+xml";
        case ".png":
            return "image/png";
        case ".jpg":
        case ".jpeg":
            return "image/jpeg";
        case ".gif":
            return "image/gif";
        case ".webp":
            return "image/webp";
        case ".ico":
            return "image/x-icon";
        case ".txt":
            return "text/plain; charset=utf-8";
        default:
            return "application/octet-stream";
    }
}
//# sourceMappingURL=liveServerService.js.map