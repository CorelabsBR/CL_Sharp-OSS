"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.applyTemplate = applyTemplate;
const promises_1 = __importDefault(require("node:fs/promises"));
const node_path_1 = __importDefault(require("node:path"));
async function applyTemplate(resourcesRoot, request) {
    const templatePath = node_path_1.default.join(resourcesRoot, "templates", "java", `${request.template}.java.tpl`);
    const raw = await promises_1.default.readFile(templatePath, "utf8");
    return raw
        .replaceAll("${PACKAGE}", request.packageName ?? "")
        .replaceAll("${NAME}", request.name ?? "");
}
//# sourceMappingURL=templateService.js.map