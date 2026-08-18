/*---------------------------------------------------------------------------------------------
- Copyright (c) CorelabsBR. All rights reserved.
- Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
import assert from "node:assert/strict";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { parseStatusLines } from "./gitService";
import { indexWorkspaceFiles, searchWorkspace } from "./searchService";

test("Git status separa alterações staged e working tree", () => {
  const [staged, working] = parseStatusLines("/workspace/project", "MM src/app.ts");
  assert.equal(staged.staged, true);
  assert.equal(working.staged, false);
  assert.equal(staged.path, "src/app.ts");
});

test("índice e busca respeitam .gitignore", async () => {
  const workspace = await mkdtemp(path.join(os.tmpdir(), "npsharp-features-"));
  try {
    await writeFile(path.join(workspace, ".gitignore"), "ignored.txt\n");
    await writeFile(path.join(workspace, "visible.ts"), "const answer = 42;\n");
    await writeFile(path.join(workspace, "ignored.txt"), "answer\n");
    const indexed = await indexWorkspaceFiles(workspace);
    assert.deepEqual(indexed.map(file => path.basename(file)), ["visible.ts"]);
    const results = await searchWorkspace({ workspace, text: "answer", caseSensitive: false, wholeWord: false, useRegex: false });
    assert.deepEqual(results.map(result => result.relativePath), ["visible.ts"]);
  } finally {
    await rm(workspace, { recursive: true, force: true });
  }
});
