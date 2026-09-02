/*---------------------------------------------------------------------------------------------
- Copyright (c) CorelabsBR. All rights reserved.
- Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
import { basename } from "node:path";

export function buildUploadRequestArgs({ repository, version, platform, sha256, filePath }) {
  return [
    "--form-string", `repository=${repository}`,
    "--form-string", `version=${version}`,
    "--form-string", `platform=${platform}`,
    "--form-string", `filename=${basename(filePath)}`,
    "--form-string", `sha256=${sha256}`,
    "--form", `file=@${filePath}`,
  ];
}
