/*---------------------------------------------------------------------------------------------
- Copyright (c) CorelabsBR. All rights reserved.
- Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
import assert from "node:assert/strict";
import test from "node:test";
import { UPDATE_IPC } from "../../shared/updateIpc";

test("contrato IPC do atualizador expõe somente operações específicas", () => {
  assert.deepEqual(UPDATE_IPC, {
    status: "update:status",
    check: "update:check",
    download: "update:download",
    install: "update:install"
  });
  assert.equal(Object.keys(UPDATE_IPC).length, 4);
});
