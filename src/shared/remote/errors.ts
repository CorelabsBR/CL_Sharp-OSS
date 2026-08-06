/*---------------------------------------------------------------------------------------------
- Copyright (c) CorelabsBR. All rights reserved.
- Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
export type RemoteErrorCode =
  | "REMOTE_AUTH_FAILED" | "REMOTE_HOST_UNREACHABLE" | "REMOTE_HOST_KEY_CHANGED"
  | "REMOTE_SERVER_INSTALL_FAILED" | "REMOTE_SERVER_START_FAILED" | "REMOTE_SERVER_VERSION_MISMATCH"
  | "REMOTE_TUNNEL_FAILED" | "REMOTE_CONNECTION_LOST" | "REMOTE_RPC_TIMEOUT"
  | "REMOTE_FILE_NOT_FOUND" | "REMOTE_FILE_MODIFIED" | "REMOTE_PERMISSION_DENIED"
  | "REMOTE_INVALID_PATH" | "REMOTE_PROCESS_FAILED";

export class RemoteError extends Error {
  constructor(readonly code: RemoteErrorCode, message: string, readonly details?: unknown) {
    super(message);
    this.name = "RemoteError";
  }
}
