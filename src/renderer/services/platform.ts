/*---------------------------------------------------------------------------------------------
- Copyright (c) CorelabsBR. All rights reserved.
- Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
import { Capacitor } from "@capacitor/core";
import { BUILD_CONFIG } from "../../shared/buildConfig";
import type { SharpApi } from "../../shared/types";

export type PlatformKind = "electron" | "capacitor" | "web";

export interface PlatformInfo {
  kind: PlatformKind;
  capacitorPlatform: string;
  isDesktop: boolean;
  isMobile: boolean;
  canUseNodeBackend: boolean;
  canUseNativeFilesystem: boolean;
  canUseGit: boolean;
  canUseTerminal: boolean;
  canUseLiveServer: boolean;
}

export const MOBILE_ROOT = BUILD_CONFIG.mobileDataDirectoryName;
export const MOBILE_WORKSPACES_ROOT = `${MOBILE_ROOT}/workspaces`;
export const DEFAULT_MOBILE_WORKSPACE = `${MOBILE_WORKSPACES_ROOT}/Main`;

type RendererWindow = typeof window & {
  sharp?: SharpApi;
  sharpApi?: SharpApi;
  process?: {
    type?: string;
    versions?: {
      electron?: string;
    };
  };
};

export function getDesktopApi(): SharpApi | undefined {
  const bridge = window as RendererWindow;
  return bridge.sharpApi ?? bridge.sharp;
}

function detectPlatform(): PlatformInfo {
  const bridge = window as RendererWindow;
  const hasPreloadApi = Boolean(getDesktopApi());
  const hasElectronProcess = bridge.process?.type === "renderer" || Boolean(bridge.process?.versions?.electron);

  if (hasPreloadApi || hasElectronProcess) {
    return {
      kind: "electron",
      capacitorPlatform: "desktop",
      isDesktop: true,
      isMobile: false,
      canUseNodeBackend: true,
      canUseNativeFilesystem: true,
      canUseGit: true,
      canUseTerminal: true,
      canUseLiveServer: true
    };
  }

  const capacitorPlatform = Capacitor.getPlatform();
  if (Capacitor.isNativePlatform()) {
    return {
      kind: "capacitor",
      capacitorPlatform,
      isDesktop: false,
      isMobile: true,
      canUseNodeBackend: false,
      canUseNativeFilesystem: true,
      canUseGit: capacitorPlatform === "android" && Capacitor.isPluginAvailable("SharpGit"),
      canUseTerminal: capacitorPlatform === "android" && Capacitor.isPluginAvailable("SharpTerminal"),
      canUseLiveServer: false
    };
  }

  return {
    kind: "web",
    capacitorPlatform,
    isDesktop: false,
    isMobile: false,
    canUseNodeBackend: false,
    canUseNativeFilesystem: false,
    canUseGit: false,
    canUseTerminal: false,
    canUseLiveServer: false
  };
}

export const platform = detectPlatform();
