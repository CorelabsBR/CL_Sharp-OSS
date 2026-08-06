/*---------------------------------------------------------------------------------------------
- Copyright (c) CorelabsBR. All rights reserved.
- Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { PathGuard } from "./PathGuard.js";

test("PathGuard aceita caminhos internos e bloqueia traversal", async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "npsharp-path-guard-"));
  try {
    const guard = new PathGuard();
    await guard.setRoots([root]);
    assert.equal(guard.resolve(path.join(root, "folder", "file.txt")), path.join(root, "folder", "file.txt"));
    assert.throws(() => guard.resolve(path.join(root, "..", "outside.txt")), /raízes autorizadas/);
    assert.throws(() => guard.resolve(`bad\0path`), /inválido/);
    const outside = await fs.mkdtemp(path.join(os.tmpdir(), "npsharp-path-outside-"));
    await fs.symlink(outside, path.join(root, "escape"));
    assert.throws(() => guard.resolve(path.join(root, "escape", "secret.txt")), /raízes autorizadas/);
    await fs.rm(outside, { recursive: true, force: true });
  } finally {
    await fs.rm(root, { recursive: true, force: true });
  }
});
