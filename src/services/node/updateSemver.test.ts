/*---------------------------------------------------------------------------------------------
- Copyright (c) CorelabsBR. All rights reserved.
- Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
import assert from "node:assert/strict";
import test from "node:test";
import { compareSemanticVersions, isNewerStableVersion } from "./updateSemver";

test("SemVer compara versões mais novas, iguais e antigas", () => {
  assert.equal(compareSemanticVersions("1.0.1", "1.0.0"), 1);
  assert.equal(compareSemanticVersions("1.5.0", "1.5.0"), 0);
  assert.equal(compareSemanticVersions("1.9.0", "2.0.0"), -1);
  assert.equal(isNewerStableVersion("1.0.0", "1.0.1"), true);
  assert.equal(isNewerStableVersion("1.5.0", "1.5.0"), false);
  assert.equal(isNewerStableVersion("2.0.0", "1.9.0"), false);
});

test("SemVer não aceita prerelease como atualização para canal estável", () => {
  assert.equal(compareSemanticVersions("1.6.0-beta.1", "1.5.0"), 1);
  assert.equal(compareSemanticVersions("1.6.0", "1.6.0-beta.1"), 1);
  assert.equal(isNewerStableVersion("1.5.0", "1.6.0-beta.1"), false);
});
