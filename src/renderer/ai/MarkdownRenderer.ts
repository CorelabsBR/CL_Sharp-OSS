/*---------------------------------------------------------------------------------------------
- Copyright (c) CorelabsBR. All rights reserved.
- Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
import { el } from "../utils/dom";

export interface CodeActions {
  copy(code: string): void | Promise<void>;
  insertBelow(code: string): void;
  replaceSelection(code: string): void;
  replaceFile(code: string): void;
  createNewFile(code: string, language: string): void;
  saveAsSnippet(code: string, language: string): void | Promise<void>;
}

export class MarkdownRenderer {
  constructor(private readonly codeActions: CodeActions) {}

  render(markdown: string): HTMLElement {
    const root = el("div", { className: "ai-markdown" });
    const lines = markdown.replace(/\r\n/gu, "\n").split("\n");
    let index = 0;
    while (index < lines.length) {
      const line = lines[index];
      const fence = /^```([\w+.-]*)\s*$/u.exec(line);
      if (fence) {
        const codeLines: string[] = [];
        index += 1;
        while (index < lines.length && !/^```\s*$/u.test(lines[index])) codeLines.push(lines[index++]);
        index += index < lines.length ? 1 : 0;
        root.append(this.codeBlock(codeLines.join("\n"), fence[1] || "text"));
        continue;
      }
      if (/^\|.+\|\s*$/u.test(line) && index + 1 < lines.length && /^\|?[\s:|-]+\|?\s*$/u.test(lines[index + 1])) {
        const tableLines = [line];
        index += 2;
        while (index < lines.length && /^\|.+\|\s*$/u.test(lines[index])) tableLines.push(lines[index++]);
        root.append(renderTable(tableLines));
        continue;
      }
      const heading = /^(#{1,6})\s+(.+)$/u.exec(line);
      if (heading) {
        const node = document.createElement(`h${heading[1].length}`);
        appendInline(node, heading[2]);
        root.append(node);
        index += 1;
        continue;
      }
      const list = /^(\s*)([-*+]|\d+\.)\s+(.+)$/u.exec(line);
      if (list) {
        const ordered = /\d+\./u.test(list[2]);
        const node = document.createElement(ordered ? "ol" : "ul");
        while (index < lines.length) {
          const match = /^(\s*)([-*+]|\d+\.)\s+(.+)$/u.exec(lines[index]);
          if (!match || /\d+\./u.test(match[2]) !== ordered) break;
          const listItem = document.createElement("li");
          const task = /^\[([ xX])\]\s+(.+)$/u.exec(match[3]);
          if (task) {
            const checkbox = el("input", { attrs: { type: "checkbox", disabled: "true", ...(task[1] !== " " ? { checked: "true" } : {}) } });
            listItem.append(checkbox);
            appendInline(listItem, task[2]);
          } else {
            appendInline(listItem, match[3]);
          }
          node.append(listItem);
          index += 1;
        }
        root.append(node);
        continue;
      }
      if (/^>\s?/u.test(line)) {
        const quote = document.createElement("blockquote");
        const quoted: string[] = [];
        while (index < lines.length && /^>\s?/u.test(lines[index])) quoted.push(lines[index++].replace(/^>\s?/u, ""));
        appendInline(quote, quoted.join("\n"));
        root.append(quote);
        continue;
      }
      if (!line.trim()) {
        index += 1;
        continue;
      }
      const paragraph = document.createElement("p");
      const paragraphLines = [line];
      index += 1;
      while (index < lines.length && lines[index].trim() && !isBlockStart(lines[index])) paragraphLines.push(lines[index++]);
      appendInline(paragraph, paragraphLines.join("\n"));
      root.append(paragraph);
    }
    return root;
  }

  private codeBlock(code: string, language: string): HTMLElement {
    const container = el("section", { className: `ai-code-block language-${safeClass(language)}` });
    const toolbar = el("div", { className: "ai-code-toolbar" });
    toolbar.append(el("span", { text: language }));
    const actions: Array<[string, () => void]> = [
      ["Copiar", () => void this.codeActions.copy(code)],
      ["Insert Below", () => this.codeActions.insertBelow(code)],
      ["Replace Selection", () => this.codeActions.replaceSelection(code)],
      ["Replace File", () => this.codeActions.replaceFile(code)],
      ["Criar novo arquivo", () => this.codeActions.createNewFile(code, language)],
      ["Salvar como trecho", () => void this.codeActions.saveAsSnippet(code, language)]
    ];
    for (const [label, run] of actions) {
      const button = el("button", { className: "ai-code-action", text: label });
      button.addEventListener("click", run);
      toolbar.append(button);
    }
    if (language.toLocaleLowerCase() === "mermaid") {
      const diagram = el("div", { className: "ai-mermaid", attrs: { role: "img", "aria-label": "Mermaid diagram source" } });
      diagram.append(el("strong", { text: "Mermaid" }), el("pre", { text: code }));
      container.append(toolbar, diagram);
      return container;
    }
    const pre = document.createElement("pre");
    const codeElement = document.createElement("code");
    codeElement.className = `language-${safeClass(language)}`;
    highlight(codeElement, code, language);
    pre.append(codeElement);
    container.append(toolbar, pre);
    return container;
  }
}

function appendInline(parent: HTMLElement, value: string): void {
  const pattern = /(!?\[[^\]]*\]\([^)]+\)|`[^`]+`|\*\*[^*]+\*\*|~~[^~]+~~|\$[^$\n]+\$)/gu;
  let cursor = 0;
  for (const match of value.matchAll(pattern)) {
    if (match.index === undefined) continue;
    parent.append(document.createTextNode(value.slice(cursor, match.index)));
    const token = match[0];
    const image = /^!\[([^\]]*)\]\(([^)]+)\)$/u.exec(token);
    const link = /^\[([^\]]+)\]\(([^)]+)\)$/u.exec(token);
    if (image && safeUrl(image[2], true)) {
      parent.append(el("img", { className: "ai-markdown-image", attrs: { src: image[2], alt: image[1], loading: "lazy" } }));
    } else if (link && safeUrl(link[2], false)) {
      const anchor = el("a", { text: link[1], attrs: { href: link[2], target: "_blank", rel: "noopener noreferrer" } });
      parent.append(anchor);
    } else if (token.startsWith("`")) {
      parent.append(el("code", { text: token.slice(1, -1) }));
    } else if (token.startsWith("**")) {
      parent.append(el("strong", { text: token.slice(2, -2) }));
    } else if (token.startsWith("~~")) {
      parent.append(el("del", { text: token.slice(2, -2) }));
    } else if (token.startsWith("$")) {
      parent.append(el("span", { className: "ai-latex", text: token.slice(1, -1), title: "LaTeX" }));
    } else {
      parent.append(document.createTextNode(token));
    }
    cursor = match.index + token.length;
  }
  parent.append(document.createTextNode(value.slice(cursor)));
}

function renderTable(lines: string[]): HTMLTableElement {
  const table = document.createElement("table");
  lines.forEach((line, rowIndex) => {
    const row = document.createElement("tr");
    splitTableRow(line).forEach(cell => {
      const element = document.createElement(rowIndex === 0 ? "th" : "td");
      appendInline(element, cell);
      row.append(element);
    });
    (rowIndex === 0 ? table.createTHead() : table.tBodies[0] ?? table.createTBody()).append(row);
  });
  return table;
}

function splitTableRow(line: string): string[] {
  return line.trim().replace(/^\||\|$/gu, "").split("|").map(cell => cell.trim());
}

function isBlockStart(line: string): boolean {
  return /^(?:#{1,6}\s|```|\|.+\||>|\s*(?:[-*+]|\d+\.)\s)/u.test(line);
}

function highlight(element: HTMLElement, code: string, language: string): void {
  if (language.toLocaleLowerCase() === "diff") {
    code.split("\n").forEach((line, index) => {
      const span = el("span", {
        className: line.startsWith("+") ? "diff-added" : line.startsWith("-") ? "diff-removed" : line.startsWith("@@") ? "diff-hunk" : "",
        text: `${line}${index < code.split("\n").length - 1 ? "\n" : ""}`
      });
      element.append(span);
    });
    return;
  }
  const tokenPattern = /(\/\/.*$|#.*$|\/\*[\s\S]*?\*\/|"(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*'|`(?:\\.|[^`\\])*`|\b(?:const|let|var|function|class|interface|type|import|export|return|if|else|for|while|async|await|public|private|protected|new|true|false|null|undefined)\b|\b\d+(?:\.\d+)?\b)/gmu;
  let cursor = 0;
  for (const match of code.matchAll(tokenPattern)) {
    if (match.index === undefined) continue;
    element.append(document.createTextNode(code.slice(cursor, match.index)));
    const token = match[0];
    const className = /^["'`]/u.test(token) ? "token-string"
      : /^(?:\/\/|#|\/\*)/u.test(token) ? "token-comment"
        : /^\d/u.test(token) ? "token-number"
          : "token-keyword";
    element.append(el("span", { className, text: token }));
    cursor = match.index + token.length;
  }
  element.append(document.createTextNode(code.slice(cursor)));
}

function safeUrl(value: string, image: boolean): boolean {
  return image ? /^(?:https?:|data:image\/)/iu.test(value) : /^(?:https?:|mailto:)/iu.test(value);
}

function safeClass(value: string): string {
  return value.replace(/[^\w-]/gu, "").slice(0, 40) || "text";
}
