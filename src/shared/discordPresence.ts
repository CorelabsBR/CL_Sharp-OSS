/*---------------------------------------------------------------------------------------------
- Copyright (c) CorelabsBR. All rights reserved.
- Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
import type { DiscordRichPresenceSettings } from "./types";

export const DEFAULT_DISCORD_RICH_PRESENCE_SETTINGS: DiscordRichPresenceSettings = Object.freeze({ enabled: true });

export function normalizeDiscordRichPresenceSettings(value: unknown): DiscordRichPresenceSettings {
  if (!value || typeof value !== "object") return { ...DEFAULT_DISCORD_RICH_PRESENCE_SETTINGS };
  const enabled = (value as { enabled?: unknown }).enabled;
  return { enabled: typeof enabled === "boolean" ? enabled : DEFAULT_DISCORD_RICH_PRESENCE_SETTINGS.enabled };
}
