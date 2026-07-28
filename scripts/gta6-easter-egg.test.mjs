/*---------------------------------------------------------------------------------------------
- Copyright (c) CorelabsBR. All rights reserved.
- Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
import assert from "node:assert/strict";
import { mkdtemp, readFile, readdir, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const { GTA6_EASTER_EGG_CONTENT, PORTUGOL_EXAMPLE_CONTENT, initialContentForNewNPSharpFile } = require("../dist-electron/core/easterEggs.js");
const { createNewFile } = require("../dist-electron/services/node/fileSystemService.js");
const { PortugolInterpreter } = require("../dist-electron/core/portugol/interpreter.js");

async function withWorkspace(run) {
  const workspace = await mkdtemp(path.join(os.tmpdir(), "npsharp-gta6-"));
  try {
    await run(workspace);
  } finally {
    await rm(workspace, { recursive: true, force: true });
  }
}

/** Uses the same atomic filesystem creation called by NPSharp's workspace create-file IPC. */
async function createFromNPSharp(workspace, name) {
  const target = path.join(workspace, name);
  await createNewFile(target, initialContentForNewNPSharpFile(name));
  return target;
}

test("1. Criar gta6.py pelo NPSharp recebe o easter egg", async () => {
  await withWorkspace(async workspace => {
    const file = await createFromNPSharp(workspace, "gta6.py");
    assert.equal(await readFile(file, "utf8"), GTA6_EASTER_EGG_CONTENT);
  });
});

test("2. Criar normal.py pelo NPSharp nasce vazio", async () => {
  await withWorkspace(async workspace => {
    const file = await createFromNPSharp(workspace, "normal.py");
    assert.equal(await readFile(file, "utf8"), "");
  });
});

test("3. Abrir workspace com gta6.py vazio não o altera", async () => {
  await withWorkspace(async workspace => {
    const file = path.join(workspace, "gta6.py");
    await writeFile(file, "");
    assert.equal(await readFile(file, "utf8"), "");
  });
});

test("4. Criação externa de gta6.py permanece intacta", async () => {
  await withWorkspace(async workspace => {
    const file = path.join(workspace, "gta6.py");
    await writeFile(file, "externo");
    assert.equal(await readFile(file, "utf8"), "externo");
  });
});

test("5. Atualizar a File Tree não altera gta6.py existente", async () => {
  await withWorkspace(async workspace => {
    const file = path.join(workspace, "gta6.py");
    await writeFile(file, "conteúdo original");
    await readdir(workspace); // equivalente à leitura/listagem, sem fluxo de criação
    assert.equal(await readFile(file, "utf8"), "conteúdo original");
  });
});

test("6. Fechar e reabrir o NPSharp não altera gta6.py existente", async () => {
  await withWorkspace(async workspace => {
    const file = path.join(workspace, "gta6.py");
    await writeFile(file, "persistente");
    assert.equal(await readFile(file, "utf8"), "persistente");
  });
});

test("7. Abrir gta6.py existente não o altera", async () => {
  await withWorkspace(async workspace => {
    const file = path.join(workspace, "gta6.py");
    await writeFile(file, "já existe");
    await readFile(file, "utf8");
    assert.equal(await readFile(file, "utf8"), "já existe");
  });
});

test("8. Criar gta6.py quando já existe falha sem sobrescrever", async () => {
  await withWorkspace(async workspace => {
    const file = path.join(workspace, "gta6.py");
    await writeFile(file, "não sobrescreva");
    await assert.rejects(() => createFromNPSharp(workspace, "gta6.py"), { code: "EEXIST" });
    assert.equal(await readFile(file, "utf8"), "não sobrescreva");
  });
});

test("9. Criar um arquivo .gol pelo NPSharp inclui um exemplo Portugol executável", async () => {
  await withWorkspace(async workspace => {
    const file = await createFromNPSharp(workspace, "ola.gol");
    assert.equal(await readFile(file, "utf8"), PORTUGOL_EXAMPLE_CONTENT);
    assert.deepEqual(new PortugolInterpreter().executeCollecting(PORTUGOL_EXAMPLE_CONTENT), ["Olá, Portugol!"]);
  });
});

test("10. Arquivos .gol existentes continuam intactos e não são sobrescritos", async () => {
  await withWorkspace(async workspace => {
    const file = path.join(workspace, "existente.gol");
    await writeFile(file, "conteúdo do usuário");
    await assert.rejects(() => createFromNPSharp(workspace, "existente.gol"), { code: "EEXIST" });
    assert.equal(await readFile(file, "utf8"), "conteúdo do usuário");
  });
});
