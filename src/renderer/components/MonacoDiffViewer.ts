/*---------------------------------------------------------------------------------------------
- Copyright (c) CorelabsBR. All rights reserved.
- Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
import type { GitDiffContent } from "../../shared/types";
import { ensureLanguageSupport, monaco } from "../../editor/monacoSetup";
import { el } from "../utils/dom";

export class MonacoDiffViewer {
  readonly element = el("section", { className: "monaco-diff-viewer" });
  private readonly editor: monaco.editor.IStandaloneDiffEditor;
  private readonly original: monaco.editor.ITextModel;
  private readonly modified: monaco.editor.ITextModel;

  private constructor(content: GitDiffContent, filePath: string) {
    this.original = monaco.editor.createModel(content.original, content.language, monaco.Uri.parse(`sharp-diff://original/${encodeURIComponent(filePath)}`));
    this.modified = monaco.editor.createModel(content.modified, content.language, monaco.Uri.parse(`sharp-diff://modified/${encodeURIComponent(filePath)}`));
    this.editor = monaco.editor.createDiffEditor(this.element, { automaticLayout: true, readOnly: true, originalEditable: false });
    this.editor.setModel({ original: this.original, modified: this.modified });
  }

  static async create(content: GitDiffContent, filePath: string): Promise<MonacoDiffViewer> {
    await ensureLanguageSupport(content.language);
    return new MonacoDiffViewer(content, filePath);
  }

  setActive(active: boolean): void {
    this.element.hidden = !active;
    if (active) this.editor.layout();
  }

  dispose(): void {
    this.editor.dispose();
    this.original.dispose();
    this.modified.dispose();
  }
}
