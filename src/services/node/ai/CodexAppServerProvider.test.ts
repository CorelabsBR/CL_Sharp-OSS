/*---------------------------------------------------------------------------------------------
- Copyright (c) CorelabsBR. All rights reserved.
- Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
import assert from "node:assert/strict";
import test from "node:test";
import { codexSandboxPolicy } from "./CodexAppServerProvider";

test("Codex limita escrita ao workspace aberto e mantém fallback somente leitura", () => {
  assert.deepEqual(codexSandboxPolicy("/workspace/project"), {
    type: "workspaceWrite",
    writableRoots: ["/workspace/project"],
    networkAccess: false
  });
  assert.deepEqual(codexSandboxPolicy(undefined), { type: "readOnly" });
});
