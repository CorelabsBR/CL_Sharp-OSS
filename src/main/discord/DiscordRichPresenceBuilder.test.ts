/*---------------------------------------------------------------------------------------------
- Copyright (c) CorelabsBR. All rights reserved.
- Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
import assert from "node:assert/strict";
import test from "node:test";
import { normalizeDiscordRichPresenceSettings } from "../../shared/discordPresence";
import { buildDiscordActivity } from "./DiscordRichPresenceBuilder";

test("builds a private, remote activity without exposing paths", () => {
  const activity = buildDiscordActivity({ filePath: "/home/user/secret/main.ts", workspacePath: "/home/user/secret", workspaceName: "secret", language: "TypeScript", remoteHost: "vortexsys" }, new Date(0));
  assert.equal(activity.details, "Editando main.ts");
  assert.match(activity.state, /Host: vortexsys/);
  assert.doesNotMatch(JSON.stringify(activity), /home\/user/);
  assert.equal(activity.smallImageKey, "remote");
  assert.equal(activity.largeImageKey, "icon");
  assert.equal(activity.largeImageText, "Sharp-OSS");
  assert.equal(activity.startTimestamp?.getTime(), 0);
});

test("maps remote connection state using the factory activity", () => {
  const activity = buildDiscordActivity({ filePath: "/private/name.ts", workspaceName: "private", remoteStatus: "installing-server" }, new Date(0));
  assert.equal(activity.details, "Instalando Sharp-OSS Server");
  assert.equal(activity.state, "Projeto: private • Local");
});

test("keeps only the on/off preference from legacy or tampered settings", () => {
  assert.deepEqual(normalizeDiscordRichPresenceSettings({ enabled: false, applicationId: "999999999999999999", buttons: [{ label: "Outro", url: "https://example.com" }] }), { enabled: false });
  assert.deepEqual(normalizeDiscordRichPresenceSettings({ enabled: "false", applicationId: "999999999999999999" }), { enabled: true });
});
