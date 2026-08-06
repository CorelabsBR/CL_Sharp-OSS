/*---------------------------------------------------------------------------------------------
- Copyright (c) CorelabsBR. All rights reserved.
- Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
import { safeStorage } from "electron";
import fs from "node:fs/promises";
import path from "node:path";
import { npsharpHome } from "../paths";

type CredentialMap = Record<string, string>;

export class RemoteCredentialStore {
  private readonly file = path.join(npsharpHome(), "remote-credentials.json");

  async set(hostId: string, password: string): Promise<void> {
    if (!safeStorage.isEncryptionAvailable()) throw new Error("O armazenamento seguro do sistema não está disponível.");
    const values = await this.read();
    values[hostId] = safeStorage.encryptString(password).toString("base64");
    await fs.mkdir(path.dirname(this.file), { recursive: true, mode: 0o700 });
    await fs.writeFile(this.file, JSON.stringify(values), { encoding: "utf8", mode: 0o600 });
  }

  async get(hostId: string): Promise<string | undefined> {
    if (!safeStorage.isEncryptionAvailable()) return undefined;
    const encrypted = (await this.read())[hostId];
    if (!encrypted) return undefined;
    try { return safeStorage.decryptString(Buffer.from(encrypted, "base64")); } catch { return undefined; }
  }

  async delete(hostId: string): Promise<void> {
    const values = await this.read();
    delete values[hostId];
    await fs.mkdir(path.dirname(this.file), { recursive: true, mode: 0o700 });
    await fs.writeFile(this.file, JSON.stringify(values), { encoding: "utf8", mode: 0o600 });
  }

  private async read(): Promise<CredentialMap> {
    try { return JSON.parse(await fs.readFile(this.file, "utf8")) as CredentialMap; } catch { return {}; }
  }
}
