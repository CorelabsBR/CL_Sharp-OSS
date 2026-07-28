/*---------------------------------------------------------------------------------------------
- Copyright (c) CorelabsBR. All rights reserved.
- Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
export interface Disposable {
  dispose(): void;
}

type CommandHandler = (...args: readonly unknown[]) => unknown | Promise<unknown>;

const registry = new Map<string, CommandHandler>();

export function registerCommand(command: string, callback: CommandHandler): Disposable {
  registry.set(command, callback);
  return {
    dispose(): void {
      registry.delete(command);
    }
  };
}

export async function executeCommand<T = unknown>(command: string, ...args: readonly unknown[]): Promise<T | undefined> {
  const handler = registry.get(command);
  if (!handler) return undefined;
  return await handler(...args) as T;
}

export function getCommands(): Promise<string[]> {
  return Promise.resolve([...registry.keys()]);
}
