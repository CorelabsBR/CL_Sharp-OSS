import type { SearchResult } from "../../shared/types";
import { api } from "../services/api";
import { el } from "../utils/dom";
import { reportError } from "../utils/errors";
import { basename } from "../utils/path";

export class SearchPanel {
  readonly element = el("div", { className: "panel search-panel" });
  private readonly query = el("input", { className: "panel-input", attrs: { placeholder: "Search" } });
  private readonly replace = el("input", { className: "panel-input", attrs: { placeholder: "Replace" } });
  private readonly useRegex = el("input", { attrs: { type: "checkbox" } });
  private readonly caseSensitive = el("input", { attrs: { type: "checkbox" } });
  private readonly wholeWord = el("input", { attrs: { type: "checkbox" } });
  private readonly summary = el("div", { className: "panel-summary", text: "Type to search" });
  private readonly list = el("div", { className: "search-results" });
  private workspace?: string;
  private debounce?: number;

  constructor(
    private readonly openResult: (result: SearchResult) => void,
    private readonly updateStatus: (text: string) => void
  ) {
    this.build();
  }

  setWorkspace(workspace?: string): void {
    this.workspace = workspace;
    void this.runSearch();
  }

  focus(): void {
    this.query.focus();
    this.query.select();
  }

  private build(): void {
    this.query.addEventListener("input", () => this.scheduleSearch());
    this.query.addEventListener("keydown", event => {
      if (event.key === "Enter" && !(event.ctrlKey || event.metaKey || event.altKey)) {
        this.list.querySelector<HTMLButtonElement>(".search-result")?.click();
      }
    });
    this.element.addEventListener("keydown", event => this.handleShortcut(event));
    this.useRegex.addEventListener("change", () => void this.runSearch());
    this.caseSensitive.addEventListener("change", () => void this.runSearch());
    this.wholeWord.addEventListener("change", () => void this.runSearch());

    const replaceAll = el("button", { className: "wide-action", text: "Replace All" });
    replaceAll.addEventListener("click", () => void this.replaceAll());

    const options = el("div", { className: "search-options" });
    options.append(labelled(this.useRegex, "Regex"), labelled(this.caseSensitive, "Match Case"), labelled(this.wholeWord, "Whole Word"));
    this.element.append(this.query, this.replace, replaceAll, options, this.summary, this.list);
  }

  private scheduleSearch(): void {
    if (this.debounce) window.clearTimeout(this.debounce);
    this.debounce = window.setTimeout(() => void this.runSearch(), 300);
  }

  private async runSearch(): Promise<void> {
    const text = this.query.value;
    if (!text) {
      this.summary.textContent = "Type to search";
      this.list.replaceChildren();
      return;
    }
    if (!this.workspace) {
      this.summary.textContent = "Open a folder to search";
      return;
    }

    try {
      this.summary.textContent = "Searching...";
      const results = await api.search.workspace({
        workspace: this.workspace,
        text,
        useRegex: this.useRegex.checked,
        caseSensitive: this.caseSensitive.checked,
        wholeWord: this.wholeWord.checked
      });
      this.renderResults(results);
      this.summary.textContent = `${results.length} result(s) in ${basename(this.workspace)}`;
    } catch (error) {
      this.summary.textContent = reportError(error, this.updateStatus, "Search failed");
    }
  }

  private async replaceAll(): Promise<void> {
    const text = this.query.value;
    if (!text) {
      this.summary.textContent = "Nothing to replace";
      return;
    }
    if (!this.workspace) {
      this.summary.textContent = "Open a folder to replace across files";
      return;
    }
    if (!confirm(`Replace "${text}" in ${basename(this.workspace)}?`)) {
      this.summary.textContent = "Replace cancelled";
      return;
    }
    try {
      this.summary.textContent = "Replacing...";
      const result = await api.search.replaceAll({
        workspace: this.workspace,
        text,
        replaceWith: this.replace.value,
        useRegex: this.useRegex.checked,
        caseSensitive: this.caseSensitive.checked,
        wholeWord: this.wholeWord.checked
      });
      this.summary.textContent = `${result.replacements} occurrence(s) replaced`;
      await this.runSearch();
    } catch (error) {
      this.summary.textContent = reportError(error, this.updateStatus, "Replace failed");
    }
  }

  private renderResults(results: SearchResult[]): void {
    this.list.replaceChildren();
    for (const result of results) {
      const row = el("button", { className: "search-result" });
      const title = el("div", { className: "search-title", text: `${basename(result.filePath)}  Ln ${result.line}, Col ${result.column}` });
      const preview = el("div", { className: "search-preview", text: result.preview });
      const replaceOne = el("button", { className: "mini-action", text: "Replace" });
      replaceOne.addEventListener("click", event => {
        event.stopPropagation();
        void this.replaceSingle(result);
      });
      row.append(title, preview, replaceOne);
      row.addEventListener("click", () => this.openResult(result));
      this.list.append(row);
    }
  }

  private async replaceSingle(result: SearchResult): Promise<void> {
    try {
      const file = await api.fs.readFile(result.filePath);
      const content = file.content;
      if (result.start < 0 || result.end <= result.start || result.end > content.length) {
        this.summary.textContent = "Invalid result position";
        return;
      }
      await api.fs.writeFile(result.filePath, content.slice(0, result.start) + this.replace.value + content.slice(result.end));
      this.summary.textContent = "1 occurrence replaced";
      await this.runSearch();
    } catch (error) {
      this.summary.textContent = reportError(error, this.updateStatus, "Replace failed");
    }
  }

  private handleShortcut(event: KeyboardEvent): void {
    if (!(event.ctrlKey || event.metaKey) || !event.altKey) return;
    const key = event.key.toLowerCase();
    if (key === "r") {
      event.preventDefault();
      this.useRegex.checked = !this.useRegex.checked;
      void this.runSearch();
    } else if (key === "c") {
      event.preventDefault();
      this.caseSensitive.checked = !this.caseSensitive.checked;
      void this.runSearch();
    } else if (key === "w") {
      event.preventDefault();
      this.wholeWord.checked = !this.wholeWord.checked;
      void this.runSearch();
    } else if (event.key === "Enter") {
      event.preventDefault();
      void this.replaceAll();
    }
  }
}

function labelled(input: HTMLInputElement, text: string): HTMLElement {
  const label = el("label", { className: "check-row" });
  label.append(input, el("span", { text }));
  return label;
}
