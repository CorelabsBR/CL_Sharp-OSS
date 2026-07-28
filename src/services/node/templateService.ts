/*---------------------------------------------------------------------------------------------
- Copyright (c) CorelabsBR. All rights reserved.
- Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
import fs from "node:fs/promises";
import path from "node:path";
import type { TemplateApplyRequest } from "../../shared/types";

export async function applyTemplate(resourcesRoot: string, request: TemplateApplyRequest): Promise<string> {
  const templatePath = path.join(resourcesRoot, "templates", "java", `${request.template}.java.tpl`);
  const raw = await fs.readFile(templatePath, "utf8");
  return raw
    .replaceAll("${PACKAGE}", request.packageName ?? "")
    .replaceAll("${NAME}", request.name ?? "");
}
