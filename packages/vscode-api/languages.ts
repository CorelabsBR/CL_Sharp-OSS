/*---------------------------------------------------------------------------------------------
- Copyright (c) CorelabsBR. All rights reserved.
- Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
export interface Disposable {
  dispose(): void;
}

export interface DocumentSelector {
  language?: string;
  scheme?: string;
  pattern?: string;
}

const registeredLanguages = new Set<string>();

export function registerLanguage(languageId: string): Disposable {
  registeredLanguages.add(languageId);
  return {
    dispose(): void {
      registeredLanguages.delete(languageId);
    }
  };
}

export function getLanguages(): Promise<string[]> {
  return Promise.resolve([...registeredLanguages].sort());
}
