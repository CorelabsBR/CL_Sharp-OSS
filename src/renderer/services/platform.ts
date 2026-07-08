import { Capacitor } from "@capacitor/core";
import type { NpsharpApi } from "../../shared/types";

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

export const MOBILE_ROOT = "NPSharp";
export const MOBILE_WORKSPACES_ROOT = `${MOBILE_ROOT}/workspaces`;
export const DEFAULT_MOBILE_WORKSPACE = `${MOBILE_WORKSPACES_ROOT}/Main`;

type RendererWindow = typeof window & {
  npsharp?: NpsharpApi;
  npsharpApi?: NpsharpApi;
  process?: {
    type?: string;
    versions?: {
      electron?: string;
    };
  };
};

export function getDesktopApi(): NpsharpApi | undefined {
  const bridge = window as RendererWindow;
  return bridge.npsharpApi ?? bridge.npsharp;
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
      canUseGit: false,
      canUseTerminal: false,
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
