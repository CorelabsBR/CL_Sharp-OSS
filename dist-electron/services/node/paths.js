"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.npsharpHome = npsharpHome;
exports.npsharpConfigDir = npsharpConfigDir;
exports.runtimeRegistryPath = runtimeRegistryPath;
exports.settingsPath = settingsPath;
exports.recentFilesPath = recentFilesPath;
exports.remoteHostsPath = remoteHostsPath;
exports.toolBinDir = toolBinDir;
const node_os_1 = __importDefault(require("node:os"));
const node_path_1 = __importDefault(require("node:path"));
function npsharpHome() {
    return node_path_1.default.join(node_os_1.default.homedir(), ".npsharp");
}
function npsharpConfigDir() {
    return node_path_1.default.join(npsharpHome(), "config");
}
function runtimeRegistryPath() {
    return node_path_1.default.join(npsharpConfigDir(), "runtime-registry.properties");
}
function settingsPath() {
    return node_path_1.default.join(npsharpHome(), "settings.json");
}
function recentFilesPath() {
    return node_path_1.default.join(npsharpHome(), "recent-files.json");
}
function remoteHostsPath() {
    return node_path_1.default.join(npsharpHome(), "remote-hosts.json");
}
function toolBinDir() {
    return node_path_1.default.join(npsharpHome(), "tools", "bin");
}
//# sourceMappingURL=paths.js.map