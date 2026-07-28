/*---------------------------------------------------------------------------------------------
- Copyright (c) CorelabsBR. All rights reserved.
- Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
export interface Disposable {
  dispose(): void;
}

export interface OutputChannel extends Disposable {
  readonly name: string;
  append(value: string): void;
  appendLine(value: string): void;
  clear(): void;
  show(): void;
  hide(): void;
}

class MemoryOutputChannel implements OutputChannel {
  private content = "";

  constructor(readonly name: string) {}

  append(value: string): void {
    this.content += value;
  }

  appendLine(value: string): void {
    this.content += `${value}\n`;
  }

  clear(): void {
    this.content = "";
  }

  show(): void {
    console.info(`[NPSharp output:${this.name}]\n${this.content}`.trim());
  }

  hide(): void {
    return;
  }

  dispose(): void {
    this.clear();
  }
}

export function createOutputChannel(name: string): OutputChannel {
  return new MemoryOutputChannel(name);
}

export async function showInformationMessage<T extends string>(message: string, ...items: T[]): Promise<T | undefined> {
  console.info(`[NPSharp extension] ${message}`);
  return items[0];
}

export async function showWarningMessage<T extends string>(message: string, ...items: T[]): Promise<T | undefined> {
  console.warn(`[NPSharp extension] ${message}`);
  return items[0];
}

export async function showErrorMessage<T extends string>(message: string, ...items: T[]): Promise<T | undefined> {
  console.error(`[NPSharp extension] ${message}`);
  return items[0];
}
