/*---------------------------------------------------------------------------------------------
- Copyright (c) CorelabsBR. All rights reserved.
- Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
import type { InstalledExtension } from "../../shared/types";
import { registerExtensionLanguage } from "../../editor/monacoSetup";
import { api } from "../services/api";
import { registerExtensionTheme } from "../services/themes";
import type { CommandRegistry } from "../commands/commandRegistry";

type ActivationState = { state: "active" | "error"; message?: string };

/** Loads declarative contributions from enabled VS Code-compatible extensions. */
export class ExtensionContributions {
  private readonly disposers: Array<() => void> = [];
  private readonly activationStates = new Map<string, ActivationState>();

  constructor(private readonly commands: CommandRegistry, private readonly updateStatus: (text: string) => void) {}

  states(): Map<string, ActivationState> {
    return new Map(this.activationStates);
  }

  async reload(): Promise<void> {
    this.disposeAll();
    for (const extension of await api.extensions.list()) {
      if (!extension.enabled) continue;
      try {
        await this.activate(extension);
        this.activationStates.set(extension.id, { state: "active" });
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        this.activationStates.set(extension.id, { state: "error", message });
        console.warn(`[NPSharp extensions] Failed to activate ${extension.id}`, error);
      }
    }
  }

  disposeAll(): void {
    for (const dispose of this.disposers.splice(0).reverse()) dispose();
    this.activationStates.clear();
  }

  private async activate(extension: InstalledExtension): Promise<void> {
    for (const theme of extension.contributes?.themes ?? []) {
      const source = await api.extensions.readFile(extension.id, theme.path);
      this.disposers.push(registerExtensionTheme(theme.id ?? `${extension.id}.${theme.label}`, theme.label, source, theme.uiTheme, theme.cat));
    }
    for (const language of extension.contributes?.languages ?? []) {
      const monarch = language.monarch ? JSON.parse(await api.extensions.readFile(extension.id, language.monarch)) as unknown : undefined;
      const configuration = language.configuration ? JSON.parse(await api.extensions.readFile(extension.id, language.configuration)) as object : undefined;
      const disposable = registerExtensionLanguage({ ...language, monarch, configuration });
      this.disposers.push(() => disposable.dispose());
    }
    for (const contribution of extension.contributes?.commands ?? []) {
      this.disposers.push(this.commands.register({
        id: contribution.command,
        category: contribution.category ?? extension.displayName,
        title: contribution.title,
        execute: () => this.updateStatus(contribution.action ?? `${extension.displayName}: ${contribution.title}`)
      }));
    }
  }
}
