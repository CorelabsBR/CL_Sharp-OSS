/*---------------------------------------------------------------------------------------------
- Copyright (c) CorelabsBR. All rights reserved.
- Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

declare module "monaco-editor/language/css/monaco.contribution.js";
declare module "monaco-editor/language/html/monaco.contribution.js";
declare module "monaco-editor/language/typescript/monaco.contribution.js";

declare module "emmet" {
  export interface EmmetConfig {
    type?: "markup" | "stylesheet";
    syntax?: string;
    maxRepeat?: number;
    options?: Record<string, unknown> & {
      "output.field"?: (index: number, placeholder: string, offset: number, line: number, column: number) => string;
    };
  }
  export interface ExtractedAbbreviation { abbreviation: string; location: number; start: number; end: number; }
  export function extract(line: string, position?: number, options?: { type?: "markup" | "stylesheet"; lookAhead?: boolean; prefix?: string }): ExtractedAbbreviation | undefined;
  export default function expandAbbreviation(abbreviation: string, config?: EmmetConfig): string;
}
