/*---------------------------------------------------------------------------------------------
- Copyright (c) CorelabsBR. All rights reserved.
- Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
import assert from "node:assert/strict";
import { resolve } from "node:path";
import test from "node:test";

import { buildUploadRequestArgs } from "./upload-cdn-request.mjs";

test("buildUploadRequestArgs sends the artifact basename as an explicit filename field", () => {
  const filePath = resolve("release", "nested output", "Sharp-OSS @1.4.1.apk");
  const sha256 = "a".repeat(64);

  assert.deepEqual(buildUploadRequestArgs({
    repository: "CL_Sharp-OSS",
    version: "v1.4.1",
    platform: "android",
    sha256,
    filePath,
  }), [
    "--form-string", "repository=CL_Sharp-OSS",
    "--form-string", "version=v1.4.1",
    "--form-string", "platform=android",
    "--form-string", "filename=Sharp-OSS @1.4.1.apk",
    "--form-string", `sha256=${sha256}`,
    "--form", `file=@${filePath}`,
  ]);
});
