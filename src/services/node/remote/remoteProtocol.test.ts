/*---------------------------------------------------------------------------------------------
- Copyright (c) CorelabsBR. All rights reserved.
- Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
import assert from "node:assert/strict";
import test from "node:test";
import { parseRpcRequest } from "../../../shared/remote/protocol";

test("protocolo RPC aceita métodos conhecidos", () => {
  assert.deepEqual(parseRpcRequest({ id: "1", method: "system.ping", params: {} }), { id: "1", method: "system.ping", params: {} });
});

test("protocolo RPC rejeita método ou mensagem inválidos", () => {
  assert.throws(() => parseRpcRequest({ id: "1", method: "danger.run", params: {} }), /REMOTE_METHOD_NOT_FOUND/);
  assert.throws(() => parseRpcRequest({ method: "system.ping", params: {} }), /REMOTE_INVALID_MESSAGE/);
});
