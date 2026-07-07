import fs from "node:fs/promises";
import path from "node:path";
import type { TemplateApplyRequest } from "../../shared/types";

export async function applyTemplate(appPath: string, request: TemplateApplyRequest): Promise<string> {
  const templatePath = path.join(appPath, "resources", "templates", "java", `${request.template}.java.tpl`);
  const raw = await fs.readFile(templatePath, "utf8");
  return raw
    .replaceAll("${PACKAGE}", request.packageName ?? "")
    .replaceAll("${NAME}", request.name ?? "");
}
