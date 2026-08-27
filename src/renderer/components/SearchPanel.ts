/*---------------------------------------------------------------------------------------------
- Copyright (c) CorelabsBR. All rights reserved.
- Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
import type { SearchResult } from "../../shared/types";
import { api, platform } from "../services/api";
import { el, icon } from "../utils/dom";
import { reportError } from "../utils/errors";
import { basename } from "../utils/path";
import { uiText } from "../../shared/i18n";

export class SearchPanel {
  readonly element = el("div", { className: "panel search-panel" });
  private readonly query = el("input", { className: "panel-input", attrs: { placeholder: uiText("Pesquisar"), "aria-label": uiText("Pesquisar"), autocomplete: "off" } });
  private readonly replace = el("input", { className: "panel-input", attrs: { placeholder: uiText("Substituir"), "aria-label": uiText("Substituir"), autocomplete: "off" } });
  private readonly useRegex = el("input", { attrs: { type: "checkbox" } });
  private readonly caseSensitive = el("input", { attrs: { type: "checkbox" } });
  private readonly wholeWord = el("input", { attrs: { type: "checkbox" } });
  private readonly include = el("input", { className: "panel-input", attrs: { placeholder: uiText("Incluir: *.ts, src/**"), "aria-label": uiText("Arquivos para incluir") } });
  private readonly exclude = el("input", { className: "panel-input", attrs: { placeholder: uiText("Excluir: node_modules, dist/**"), "aria-label": uiText("Arquivos para excluir") } });
  private readonly summary = el("div", { className: "panel-summary", text: uiText("Digite para pesquisar"), attrs: { role: "status", "aria-live": "polite" } });
  private readonly list = el("div", { className: "search-results", attrs: { role: "list" } });
  private workspace?: string;
  private debounce?: number;
  private requestVersion = 0;
  private activeRequestId?: string;
  private disposed = false;

  constructor(
    private readonly openResult: (result: SearchResult) => void,
    private readonly updateStatus: (text: string) => void
  ) {
    this.build();
  }

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    this.requestVersion += 1;
    if (this.activeRequestId) void api.search.cancel(this.activeRequestId);
    if (this.debounce !== undefined) {
      window.clearTimeout(this.debounce);
      this.debounce = undefined;
    }
    this.list.replaceChildren();
  }

  setWorkspace(workspace?: string): void {
    if (this.disposed) return;
    this.workspace = workspace;
    void this.runSearch();
  }

  focus(): void {
    if (this.disposed) return;
    this.query.focus();
    this.query.select();
  }

  focusReplace(): void {
    if (this.disposed) return;
    this.replace.focus();
    this.replace.select();
  }

  private build(): void {
    this.query.addEventListener("input", () => this.scheduleSearch());
    this.include.addEventListener("input", () => this.scheduleSearch());
    this.exclude.addEventListener("input", () => this.scheduleSearch());
    this.query.addEventListener("keydown", event => {
      if (event.key === "Enter" && !(event.ctrlKey || event.metaKey || event.altKey)) {
        this.list.querySelector<HTMLElement>(".search-result")?.click();
      }
    });
    this.element.addEventListener("keydown", event => this.handleShortcut(event));
    this.useRegex.addEventListener("change", () => void this.runSearch());
    this.caseSensitive.addEventListener("change", () => void this.runSearch());
    this.wholeWord.addEventListener("change", () => void this.runSearch());

    const replaceAll = el("button", { className: "wide-action search-replace-all", text: uiText("Substituir tudo") });
    replaceAll.addEventListener("click", () => void this.replaceAll());

    const options = el("div", { className: "search-options" });
    options.append(labelled(this.useRegex, "Regex"), labelled(this.caseSensitive, uiText("Diferenciar maiúsculas/minúsculas")), labelled(this.wholeWord, uiText("Palavra inteira")));
    const queryBlock = el("section", { className: "search-query-block", attrs: { "aria-label": uiText("Pesquisar") } });
    const queryRow = el("div", { className: "search-query-row" });
    queryRow.append(this.query);
    const replaceRow = el("div", { className: "search-replace-row" });
    replaceRow.append(this.replace, replaceAll);
    queryBlock.append(queryRow, replaceRow, options);

    const filters = el("section", { className: "search-filter-block", attrs: { "aria-label": uiText("Filtros de arquivos") } });
    filters.append(el("span", { className: "search-filter-label", text: uiText("Arquivos para incluir e excluir") }), this.include, this.exclude);
    const resultsHeader = el("div", { className: "search-results-header" });
    resultsHeader.append(el("span", { text: uiText("Resultados") }), this.summary);
    this.element.append(queryBlock, filters, resultsHeader, this.list);
  }

  private scheduleSearch(): void {
    if (this.disposed) return;
    if (this.debounce !== undefined) window.clearTimeout(this.debounce);
    this.debounce = window.setTimeout(() => {
      this.debounce = undefined;
      void this.runSearch();
    }, 300);
  }

  private async runSearch(): Promise<void> {
    if (this.disposed) return;
    const version = ++this.requestVersion;
    if (this.activeRequestId) void api.search.cancel(this.activeRequestId);
    this.activeRequestId = undefined;
    const text = this.query.value;
    if (!text) {
      this.summary.textContent = uiText("Digite para pesquisar");
      this.list.replaceChildren();
      return;
    }
    if (!this.workspace) {
      this.summary.textContent = platform.isMobile
        ? uiText("Abra um workspace mobile para pesquisar")
        : uiText("Abra uma pasta para pesquisar");
      return;
    }
    const requestId = crypto.randomUUID();
    this.activeRequestId = requestId;

    try {
      this.summary.textContent = uiText("Pesquisando...");
      const results = await api.search.workspace({
        workspace: this.workspace,
        text,
        useRegex: this.useRegex.checked,
        caseSensitive: this.caseSensitive.checked,
        wholeWord: this.wholeWord.checked,
        include: this.include.value,
        exclude: this.exclude.value,
        requestId
      });
      if (this.disposed || version !== this.requestVersion) return;
      this.renderResults(results);
      this.summary.textContent = uiText("{count} resultado(s) em {workspace}").replace("{count}", String(results.length)).replace("{workspace}", basename(this.workspace));
    } catch (error) {
      if (this.disposed || version !== this.requestVersion) return;
      this.summary.textContent = reportError(error, this.updateStatus, uiText("Falha na pesquisa"));
    } finally {
      if (this.activeRequestId === requestId) this.activeRequestId = undefined;
    }
  }

  private async replaceAll(): Promise<void> {
    if (this.disposed) return;
    const text = this.query.value;
    if (!text) {
      this.summary.textContent = uiText("Nada para substituir");
      return;
    }
    if (!this.workspace) {
      this.summary.textContent = platform.isMobile
        ? uiText("Abra um workspace mobile para substituir nos arquivos")
        : uiText("Abra uma pasta para substituir nos arquivos");
      return;
    }
    if (!confirm(uiText('Substituir "{text}" em {workspace}?').replace("{text}", text).replace("{workspace}", basename(this.workspace)))) {
      this.summary.textContent = uiText("Substituição cancelada");
      return;
    }
    try {
      this.summary.textContent = uiText("Substituindo...");
      const result = await api.search.replaceAll({
        workspace: this.workspace,
        text,
        replaceWith: this.replace.value,
        useRegex: this.useRegex.checked,
        caseSensitive: this.caseSensitive.checked,
        wholeWord: this.wholeWord.checked,
        include: this.include.value,
        exclude: this.exclude.value
      });
      if (this.disposed) return;
      this.summary.textContent = uiText("{count} ocorrência(s) substituída(s)").replace("{count}", String(result.replacements));
      await this.runSearch();
    } catch (error) {
      if (this.disposed) return;
      this.summary.textContent = reportError(error, this.updateStatus, uiText("Falha ao substituir"));
    }
  }

  private renderResults(results: SearchResult[]): void {
    if (this.disposed) return;
    this.list.replaceChildren();
    if (!results.length) {
      this.list.append(el("div", {
        className: "search-empty ui-empty-state",
        children: [
          el("span", { className: "search-empty-icon", children: [icon("search", uiText("Pesquisar"))] }),
          el("strong", { text: uiText("Nenhum resultado encontrado") }),
          el("span", { text: uiText("Tente ajustar a busca ou os filtros de arquivo.") })
        ]
      }));
      return;
    }
    const grouped = new Map<string, SearchResult[]>();
    for (const result of results) {
      const key = result.relativePath || result.filePath;
      grouped.set(key, [...(grouped.get(key) ?? []), result]);
    }

    for (const [file, fileResults] of grouped) {
      const group = el("section", { className: "search-file-group" });
      group.append(el("div", { className: "search-file-title", text: `${file} (${fileResults.length})` }));
      for (const result of fileResults) {
        const title = el("div", { className: "search-title", text: uiText("Ln {line}, Col {column}").replace("{line}", String(result.line)).replace("{column}", String(result.column)) });
        const preview = el("div", { className: "search-preview", text: result.preview });
        const row = el("div", {
          className: "search-result",
          attrs: { role: "button", tabindex: "0", "aria-label": `${title.textContent}: ${result.preview}` }
        });
        const replaceOne = el("button", { className: "mini-action", text: uiText("Substituir"), attrs: { type: "button" } });
        replaceOne.addEventListener("click", event => {
          event.stopPropagation();
          void this.replaceSingle(result);
        });
        row.append(title, preview, replaceOne);
        row.addEventListener("click", () => this.openResult(result));
        row.addEventListener("keydown", event => {
          if (event.target !== row || (event.key !== "Enter" && event.key !== " ")) return;
          event.preventDefault();
          this.openResult(result);
        });
        group.append(row);
      }
      this.list.append(group);
    }
  }

  private async replaceSingle(result: SearchResult): Promise<void> {
    if (this.disposed) return;
    try {
      const file = await api.fs.readFile(result.filePath);
      if (this.disposed) return;
      const content = file.content;
      if (result.start < 0 || result.end <= result.start || result.end > content.length) {
        this.summary.textContent = uiText("Posição de resultado inválida");
        return;
      }
      await api.fs.writeFile(result.filePath, content.slice(0, result.start) + this.replace.value + content.slice(result.end));
      if (this.disposed) return;
      this.summary.textContent = uiText("1 ocorrência substituída");
      await this.runSearch();
    } catch (error) {
      if (this.disposed) return;
      this.summary.textContent = reportError(error, this.updateStatus, uiText("Falha ao substituir"));
    }
  }

  private handleShortcut(event: KeyboardEvent): void {
    if (this.disposed) return;
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
