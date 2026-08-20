/*---------------------------------------------------------------------------------------------
- Copyright (c) CorelabsBR. All rights reserved.
- Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import test from "node:test";

const require = createRequire(import.meta.url);
const { CommandRegistry, fuzzyScore } = require("../dist-electron/renderer/commands/commandRegistry.js");
const { parseQuickOpenQuery } = require("../dist-electron/renderer/commands/quickOpen.js");
const { emmetAbbreviationAt, emmetLanguageConfig } = require("../dist-electron/editor/emmet.js");

test("Command Registry registra, executa e remove comandos", async () => {
  const registry = new CommandRegistry();
  let executions = 0;
  const dispose = registry.register({ id: "test.run", category: "Test", title: "Run", execute: () => { executions++; } });
  assert.equal(await registry.execute("test.run"), true);
  assert.equal(executions, 1);
  dispose();
  assert.equal(await registry.execute("test.run"), false);
});

test("fuzzy ranking rejeita texto sem correspondência ordenada", () => {
  assert.ok(fuzzyScore("cmd", "command") >= 0);
  assert.equal(fuzzyScore("xyz", "command"), -1);
});

test("Quick Open interpreta linha e coluna sem confundir caminhos", () => {
  assert.deepEqual(parseQuickOpenQuery("src/main.ts:12:4"), { query: "src/main.ts", line: 12, column: 4 });
  assert.deepEqual(parseQuickOpenQuery("C:\\project\\main.ts"), { query: "C:\\project\\main.ts" });
});

test("Emmet oferece autocomplete nos dialetos de markup e estilos", () => {
  assert.deepEqual(emmetLanguageConfig("typescript", "/src/card.tsx"), { type: "markup", syntax: "jsx" });
  assert.equal(emmetLanguageConfig("typescript", "/src/card.ts"), undefined);
  assert.match(emmetAbbreviationAt("div.card", { type: "markup", syntax: "jsx" }).snippet, /className="card"/);
  assert.match(emmetAbbreviationAt("m10", { type: "stylesheet", syntax: "css" }).snippet, /margin: 10px/);
  assert.match(emmetAbbreviationAt("node>child", { type: "markup", syntax: "xml" }).snippet, /<child>\$1<\/child>/);
});
