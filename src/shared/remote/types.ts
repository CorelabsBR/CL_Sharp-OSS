/*---------------------------------------------------------------------------------------------
- Copyright (c) CorelabsBR. All rights reserved.
- Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
export type RemoteConnectionStatus =
  | "disconnected" | "resolving-host" | "connecting" | "verifying-host-key"
  | "authenticating" | "detecting-platform" | "checking-server" | "uploading-server"
  | "installing-server" | "starting-server" | "reading-bootstrap" | "opening-tunnel"
  | "connecting-websocket" | "authenticating-session" | "validating-server"
  | "connected" | "reconnecting" | "disconnecting" | "failed";

export type RemoteAuthenticationType = "privateKey" | "password" | "sshAgent";

export interface RemoteHostConfigV2 {
  id: string;
  name: string;
  host: string;
  port: number;
  username: string;
  authenticationType: RemoteAuthenticationType;
  privateKeyPath?: string;
  remotePath?: string;
  connectTimeout?: number;
  keepAliveInterval?: number;
  /** SHA256 host-key fingerprint. An absent value requires an explicit trust decision. */
  hostKeyFingerprint?: string;
}

export interface RemoteConnectionState {
  sessionId?: string;
  hostId?: string;
  status: RemoteConnectionStatus;
  message: string;
  connectedAt?: number;
  latencyMs?: number;
  serverVersion?: string;
  serverPid?: number;
  remotePath?: string;
}

export interface RemotePlatformInfo {
  platform: "linux" | "darwin" | "win32";
  architecture: string;
  distribution?: string;
  distributionVersion?: string;
  kernel?: string;
  homeDirectory: string;
  temporaryDirectory: string;
  defaultShell: string;
  hasTar: boolean;
  hasUnzip: boolean;
  hasNode: boolean;
  nodeVersion?: string;
}

export interface RemoteServerBootstrap {
  sessionId: string; pid: number; host: "127.0.0.1"; port: number; token: string;
  version: string; protocolVersion: number; capabilities: string[]; startedAt: string; logFile: string;
}

export interface RemoteSessionSummary {
  id: string; hostId: string; hostName: string; workspace?: string;
  platform: RemotePlatformInfo; bootstrap: Omit<RemoteServerBootstrap, "token">;
}

export interface RemoteLogEntry {
  timestamp: string; level: "debug" | "info" | "warn" | "error";
  scope: "connection" | "ssh" | "installer" | "launcher" | "tunnel" | "websocket" | "rpc" | "workspace";
  message: string; metadata?: Record<string, unknown>;
}

export interface RemoteDocumentMetadata {
  uri: string;
  mtimeMs: number;
  size: number;
  etag: string;
}

export interface RemoteFileReadResult {
  content: string;
  metadata: RemoteDocumentMetadata;
}

export interface RemoteWriteRequest {
  path: string;
  content: string;
  etag?: string;
  overwrite?: boolean;
}

export interface RemoteEntry {
  path: string;
  name: string;
  directory: boolean;
  size: number;
  modifiedAt: number;
  hidden: boolean;
}

export interface RemoteConnectRequest {
  hostId: string;
  password?: string;
  trustFingerprint?: string;
  persistTrust?: boolean;
}
