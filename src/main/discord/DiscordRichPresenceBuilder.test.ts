/*---------------------------------------------------------------------------------------------
- Copyright (c) CorelabsBR. All rights reserved.
- Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
import assert from "node:assert/strict";
import test from "node:test";
import type { DiscordRichPresenceSettings } from "../../shared/types";
import { buildDiscordActivity } from "./DiscordRichPresenceBuilder";

const settings: DiscordRichPresenceSettings = {
  enabled: true, applicationId: "1534982448679485551", showFileName: true, showProjectName: true, showLanguage: true,
  showRemoteHost: true, showElapsedTime: true, showWorkspaceType: true, largeImageKey: "icon",
  largeImageText: "NPSharp", localSmallImageKey: "local", remoteSmallImageKey: "remote",
  localSmallImageText: "Workspace local", remoteSmallImageText: "Remote Host",
  buttons: [{ label: "Site", url: "https://npsharp.corelabs.dev.br" }, { label: "Inválido", url: "javascript:alert(1)" }]
};

test("builds a private, remote activity without exposing paths", () => {
  const activity = buildDiscordActivity(settings, { filePath: "/home/user/secret/main.ts", workspacePath: "/home/user/secret", workspaceName: "secret", language: "TypeScript", remoteHost: "vortexsys" }, new Date(0));
  assert.equal(activity.details, "Editando main.ts");
  assert.match(activity.state, /Host: vortexsys/);
  assert.doesNotMatch(JSON.stringify(activity), /home\/user/);
  assert.equal(activity.smallImageKey, "remote");
  assert.deepEqual(activity.buttons, [{ label: "Site", url: "https://npsharp.corelabs.dev.br" }]);
});

test("respects privacy flags and maps remote connection state", () => {
  const activity = buildDiscordActivity({ ...settings, showFileName: false, showProjectName: false, showLanguage: false, showRemoteHost: false, showWorkspaceType: false }, { filePath: "/private/name.ts", workspaceName: "private", remoteStatus: "installing-server" }, new Date(0));
  assert.equal(activity.details, "Instalando NPSharp Server");
  assert.equal(activity.state, "IDE em execução");
  assert.doesNotMatch(JSON.stringify(activity), /name\.ts|private/);
});
