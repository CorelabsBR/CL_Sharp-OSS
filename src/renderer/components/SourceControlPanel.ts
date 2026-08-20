/*---------------------------------------------------------------------------------------------
- Copyright (c) CorelabsBR. All rights reserved.
- Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
import type { GitCommit, GitDiffContent, GitFileStatus, GitRepositoryStatus } from "../../shared/types";
import { api, platform } from "../services/api";
import { buttonIcon, el, fileIcon } from "../utils/dom";
import { reportError } from "../utils/errors";
import { showInputDialog } from "../utils/inputDialog";

export class SourceControlPanel {
  readonly element = el("div", { className: "panel scm-panel" });
  private readonly summary = el("div", { className: "panel-summary", text: "Nenhum repositório" });
  private readonly commitInput = el("input", { className: "panel-input", attrs: { placeholder: "Mensagem do commit" } });
  private readonly allowEmpty = el("input", { attrs: { type: "checkbox" } });
  private readonly amend = el("input", { attrs: { type: "checkbox" } });
  private readonly list = el("div", { className: "scm-list" });
  private readonly gitActions: HTMLButtonElement[] = [];
  private workspace?: string;
  private repos: GitRepositoryStatus[] = [];
  private busy = false;

  constructor(
    private readonly openVirtualFile: (title: string, uri: string, content: string) => void,
    private readonly updateStatus: (text: string) => void,
    private readonly openDiffEditor?: (title: string, uri: string, filePath: string, content: GitDiffContent) => void
  ) {
    this.build();
  }

  async setWorkspace(workspace?: string): Promise<void> {
    this.workspace = workspace;
    await this.refresh();
  }

  async refresh(): Promise<void> {
    this.list.replaceChildren();
    if (!platform.canUseGit) {
      this.renderLimitedMode();
      return;
    }
    if (!this.workspace) {
      this.summary.textContent = "Abra uma pasta para usar o controle de código-fonte";
      return;
    }
    try {
      this.summary.textContent = "Verificando repositórios...";
      this.repos = await api.git.status(this.workspace);
      this.render();
    } catch (error) {
      this.summary.textContent = reportError(error, this.updateStatus, "Falha ao atualizar o controle de código-fonte");
    }
  }

  async runOnFirstRepo(args: string[]): Promise<void> {
    if (!platform.canUseGit) {
      this.updateStatus(platform.isMobile ? "Git requer Android e um workspace salvo na área do NPSharp." : "Git local nao esta disponivel neste modo.");
      return;
    }
    const repo = this.repos[0];
    if (!repo) return;
    await this.runOperation(`Git ${args[0]}...`, async () => api.git.run(repo.repo, args));
  }

  async commit(): Promise<void> {
    await this.commitAll();
  }

  async getDiffContext(): Promise<string> {
    if (!platform.canUseGit || !this.repos.length) return "";
    const sections: string[] = [];
    for (const repo of this.repos) {
      const unstaged = await api.git.run(repo.repo, ["diff"]);
      const staged = await api.git.run(repo.repo, ["diff", "--cached"]);
      if (unstaged.output.trim()) sections.push(`# ${repo.name} (unstaged)\n${unstaged.output}`);
      if (staged.output.trim()) sections.push(`# ${repo.name} (staged)\n${staged.output}`);
    }
    return sections.join("\n\n");
  }

  private build(): void {
    const toolbar = el("div", { className: "panel-toolbar" });
    const refresh = buttonIcon("refresh", "Atualizar", () => void this.refresh());
    const stageAll = buttonIcon("add", "Preparar tudo", () => void this.stageAll());
    const unstageAll = buttonIcon("remove", "Remover tudo da preparação", () => void this.unstageAll());
    const commit = buttonIcon("check", "Commit", () => void this.commitAll());
    const pull = buttonIcon("repo-pull", "Pull", () => void this.runOnFirstRepo(["pull"]));
    const push = buttonIcon("repo-push", "Push", () => void this.runOnFirstRepo(["push"]));
    const fetch = buttonIcon("repo-fetch", "Fetch", () => void this.runOnFirstRepo(["fetch"]));
    const stash = buttonIcon("archive", "Stash", () => void this.runOnFirstRepo(["stash", "push"]));
    const stashPop = buttonIcon("restore", "Stash pop", () => void this.runOnFirstRepo(["stash", "pop"]));
    this.gitActions.push(stageAll, unstageAll, commit, pull, push, fetch, stash, stashPop);
    toolbar.append(refresh, stageAll, unstageAll, commit, pull, push, fetch, stash, stashPop);
    this.commitInput.addEventListener("keydown", event => {
      if (event.key === "Enter") void this.commitAll();
    });
    const allowEmptyRow = el("label", { className: "check-row" });
    allowEmptyRow.append(this.allowEmpty, el("span", { text: "Permitir commit vazio" }));
    const amendRow = el("label", { className: "check-row" });
    amendRow.append(this.amend, el("span", { text: "Amend" }));
    this.element.append(toolbar, this.summary, this.commitInput, allowEmptyRow, amendRow, this.list);
    this.applyCapabilityState();
  }

  private render(): void {
    this.applyCapabilityState();
    const changes = this.repos.reduce((sum, repo) => sum + repo.files.length, 0);
    this.summary.textContent = this.repos.length === 0 ? "Nenhum repositório Git encontrado" : `${this.repos.length} repositório(s), ${changes} alteração(ões)`;
    this.list.replaceChildren();
    for (const repo of this.repos) {
      const repoBlock = el("section", { className: "scm-repo" });
      const header = el("div", { className: "scm-repo-header" });
      header.append(
        el("strong", { text: repo.name }),
        el("span", { text: repo.branch }),
        el("span", { text: repo.ahead || repo.behind ? `↑${repo.ahead} ↓${repo.behind}` : "" }),
        buttonIcon("git-branch", "Branch", () => void this.chooseBranch(repo)),
        buttonIcon("trash", "Excluir branch", () => void this.deleteBranch(repo)),
        buttonIcon("history", "History", () => void this.showHistory(repo))
      );
      repoBlock.append(header);
      if (repo.clean) repoBlock.append(el("div", { className: "muted-row", text: "Árvore de trabalho limpa" }));
      const groups: Array<[string, GitFileStatus[]]> = [
        ["Conflicts", repo.files.filter(file => file.conflicted)],
        ["Staged Changes", repo.files.filter(file => file.staged && !file.conflicted)],
        ["Changes", repo.files.filter(file => !file.staged && !file.conflicted && file.kind !== "untracked" && !file.ignored)],
        ["Untracked", repo.files.filter(file => file.kind === "untracked")]
      ];
      for (const [label, files] of groups) {
        if (!files.length) continue;
        repoBlock.append(el("div", { className: "scm-group-title", text: `${label} (${files.length})` }));
        for (const file of files) repoBlock.append(this.fileRow(repo, file));
      }
      this.list.append(repoBlock);
    }
  }

  private renderLimitedMode(): void {
    this.repos = [];
    this.applyCapabilityState();
    this.summary.textContent = platform.isMobile
      ? "Controle de código-fonte mobile em modo limitado."
      : "Controle de código-fonte limitado no modo web.";
    this.list.replaceChildren(
      el("div", {
        className: "muted-row",
        text: platform.isMobile
          ? "Git completo depende de um backend nativo futuro. Commit, push, pull, stage e discard ficam desabilitados."
          : "Git completo depende do backend Electron/Node."
      })
    );
    if (this.workspace) {
      this.list.append(el("div", { className: "muted-row", text: `Workspace local: ${this.workspace}` }));
    }
  }

  private applyCapabilityState(): void {
    const disabled = !platform.canUseGit || this.busy;
    for (const button of this.gitActions) button.disabled = disabled;
    this.commitInput.disabled = disabled;
    this.allowEmpty.disabled = disabled;
    this.amend.disabled = disabled;
  }

  private fileRow(repo: GitRepositoryStatus, file: GitFileStatus): HTMLElement {
    const row = el("div", { className: "scm-file" });
    row.append(
      fileIcon(file.path, false),
      el("span", { className: `scm-kind ${file.kind}`, text: labelFor(file) }),
      el("span", { className: "scm-path", text: file.path })
    );
    const actions = el("div", { className: "row-actions" });
    actions.append(
      buttonIcon(file.staged ? "remove" : "add", file.staged ? "Remover da preparação" : "Preparar", () => void this.stageToggle(repo, file)),
      buttonIcon("diff", "Diff", () => void this.showDiff(repo, file)),
      buttonIcon("debug-breakpoint-conditional", "Resolver conflito", () => void this.resolveConflict(repo, file)),
      buttonIcon("discard", "Descartar", () => void this.discard(repo, file))
    );
    actions.querySelector<HTMLButtonElement>('[title="Resolver conflito"]')!.hidden = !file.conflicted;
    row.append(actions);
    return row;
  }
  // eu costumava escrever o nome dela ao testar uma caneta.
  // hoje, apenas:
  /*
  @@@@@@@@@@@@@@@@@@@@@@       @@@@@@@@@@@@@@@@@@@@@@         @@@@@@@@@@@@@@@@@@@@@@@@
  @@@@@@@@@@@@@@@@@@@@@@@@     @@@@@@@@@@@@@@@@@@@@@@@@       @@@@@@@@@@@@@@@@@@@@@@@@
  @@@@@@@@@@@@@@@@@@@@@@@@@@   @@@@@@@@@@@@@@@@@@@@@@@@@@     @@@@@@@@@@@@@@@@@@@@@@@@
    @@@@@@@@@@     @@@@@@@@@     @@@@@@@@@@     @@@@@@@@@        @@@@@@@@@      @@@@@@
    @@@@@@@@@@     @@@@@@@@@     @@@@@@@@@@     @@@@@@@@@        @@@@@@@@@            
    @@@@@@@@@@     @@@@@@@@@     @@@@@@@@@@     @@@@@@@@@        @@@@@@@@@            
    @@@@@@@@@@@@@@@@@@@@@@@@     @@@@@@@@@@@@@@@@@@@@@@@@        @@@@@@@@@@@@@@@@     
    @@@@@@@@@@@@@@@@@@@@@@       @@@@@@@@@@@@@@@@@@@@@@          @@@@@@@@@@@@@@@@     
    @@@@@@@@@@@@@@@@@@@         @@@@@@@@@@@@@@@@@@@@            @@@@@@@@@@@@@@@@     
    @@@@@@@@@@                   @@@@@@@@@@ @@@@@@@@@            @@@@@@@@@            
    @@@@@@@@@@                   @@@@@@@@@@   @@@@@@@@           @@@@@@@@@            
    @@@@@@@@@@                   @@@@@@@@@@    @@@@@@@@@         @@@@@@@@@            
  @@@@@@@@@@@@@@               @@@@@@@@@@@@@@ @@@@@@@@@@@@@   @@@@@@@@@@@@@@@         
  @@@@@@@@@@@@@@               @@@@@@@@@@@@@@ @@@@@@@@@@@@@   @@@@@@@@@@@@@@@         
  @@@@@@@@@@@@@@               @@@@@@@@@@@@@@ @@@@@@@@@@@@@   @@@@@@@@@@@@@@@         
*/



  private async stageAll(): Promise<void> {
    if (!platform.canUseGit) return this.renderLimitedMode();
    await this.runOnFirstRepo(["add", "-A"]);
  }

  private async unstageAll(): Promise<void> {
    if (!platform.canUseGit) return this.renderLimitedMode();
    await this.runOnFirstRepo(["restore", "--staged", "."]);
  }

  private async stageToggle(repo: GitRepositoryStatus, file: GitFileStatus): Promise<void> {
    if (!platform.canUseGit) return this.renderLimitedMode();
    await this.runOperation(file.staged ? "Removendo do stage..." : "Adicionando ao stage...", () => file.staged ? api.git.unstage(repo.repo, file) : api.git.stage(repo.repo, file));
  }

  private async discard(repo: GitRepositoryStatus, file: GitFileStatus): Promise<void> {
    if (!platform.canUseGit) return this.renderLimitedMode();
    if (!confirm(`Discard changes in ${file.path}?`)) return;
    await this.runOperation("Descartando alterações...", () => api.git.discard(repo.repo, file));
  }

  private async commitAll(): Promise<void> {
    if (!platform.canUseGit) return this.renderLimitedMode();
    const message = this.commitInput.value.trim();
    const repo = this.repos[0];
    if (!repo || !message) return;
    this.busy = true;
    this.applyCapabilityState();
    this.updateStatus(this.amend.checked ? "Alterando último commit..." : "Criando commit...");
    try {
      const result = this.amend.checked
        ? await api.git.run(repo.repo, ["commit", "--amend", "-m", message])
        : await api.git.commit(repo.repo, message, this.allowEmpty.checked);
      this.updateStatus(result.output || (result.success ? "Commit criado" : "Falha no commit"));
      if (result.success) this.commitInput.value = "";
    } catch (error) {
      reportError(error, this.updateStatus, "Falha no commit");
    } finally {
      this.busy = false;
      await this.refresh();
    }
  }

  private async runOperation(label: string, operation: () => Promise<{ success: boolean; output: string }>): Promise<void> {
    if (this.busy) {
      this.updateStatus("Já existe uma operação Git em andamento.");
      return;
    }
    this.busy = true;
    this.applyCapabilityState();
    this.updateStatus(label);
    try {
      const result = await operation();
      this.updateStatus(result.output || (result.success ? "Operação Git concluída" : "Falha ao executar Git"));
    } catch (error) {
      reportError(error, this.updateStatus, "Falha ao executar Git");
    } finally {
      this.busy = false;
      await this.refresh();
    }
  }

  private async showDiff(repo: GitRepositoryStatus, file: GitFileStatus): Promise<void> {
    try {
      if (this.openDiffEditor) {
        const content = await api.git.diffContent(repo.repo, file, file.staged);
        this.openDiffEditor(`${file.path} (${file.staged ? "Staged" : "Changes"})`, `git-diff:${repo.repo}:${file.path}:${file.staged}`, file.path, content);
        return;
      }
      const diff = await api.git.diff(repo.repo, file, file.staged);
      this.openVirtualFile(`${file.path}.diff`, `git:${repo.repo}:${file.path}:${file.staged}`, diff || "Nenhuma diferença disponível");
    } catch (error) {
      reportError(error, this.updateStatus, `Git diff failed (${file.path})`);
    }
  }

  private async showHistory(repo: GitRepositoryStatus): Promise<void> {
    const commits = await api.git.history(repo.repo);
    this.openVirtualFile(`${repo.name} history`, `git:${repo.repo}:history`, formatHistory(commits));
  }

  private async chooseBranch(repo: GitRepositoryStatus): Promise<void> {
    const next = await showInputDialog(`Branch para ${repo.name}`, repo.branch, { placeholder: `Existentes: ${repo.branches.join(", ")}` });
    if (!next?.trim() || next.trim() === repo.branch) return;
    const branch = next.trim();
    const result = repo.branches.includes(branch)
      ? await api.git.checkout(repo.repo, branch)
      : confirm(`Create branch "${branch}" from ${repo.branch}?`)
        ? await api.git.createBranch(repo.repo, branch)
        : { success: false, output: "Operação de branch cancelada" };
    this.updateStatus(result.output || (result.success ? "Operação de branch concluída" : "Falha na operação de branch"));
    await this.refresh();
  }

  private async deleteBranch(repo: GitRepositoryStatus): Promise<void> {
    const branch = (await showInputDialog("Excluir branch local", "", { placeholder: repo.branches.filter(item => item !== repo.branch).join(", ") }))?.trim();
    if (!branch || branch === repo.branch || !repo.branches.includes(branch)) {
      this.updateStatus(branch === repo.branch ? "Não é possível excluir a branch atual." : "Branch inválida.");
      return;
    }
    if (!confirm(`Excluir a branch local "${branch}"?`)) return;
    await this.runOperation("Excluindo branch...", () => api.git.run(repo.repo, ["branch", "-d", branch]));
  }

  private async resolveConflict(repo: GitRepositoryStatus, file: GitFileStatus): Promise<void> {
    if (!file.conflicted) {
      await this.showDiff(repo, file);
      return;
    }
    const choice = (await showInputDialog(`Resolver conflito em ${file.path}`, "manual", { placeholder: "current, incoming ou manual" }))?.trim().toLowerCase();
    if (!choice || choice === "manual") {
      await this.showDiff(repo, file);
      return;
    }
    if (choice !== "current" && choice !== "incoming") {
      this.updateStatus("Resolução de conflito cancelada");
      return;
    }
    const checkout = await api.git.run(repo.repo, ["checkout", choice === "current" ? "--ours" : "--theirs", "--", file.path]);
    if (!checkout.success) {
      this.updateStatus(checkout.output || "Falha ao resolver o conflito");
      return;
    }
    const add = await api.git.stage(repo.repo, file);
    this.updateStatus(add.output || (add.success ? "Conflito resolvido e preparado" : "Falha ao resolver o conflito"));
    await this.refresh();
  }
}

function labelFor(file: GitFileStatus): string {
  const labels: Record<string, string> = {
    added: "A",
    modified: "M",
    deleted: "D",
    renamed: "R",
    untracked: "U",
    conflicted: "!",
    ignored: "I"
  };
  return labels[file.kind] ?? "?";
}

function formatHistory(commits: GitCommit[]): string {
  if (commits.length === 0) return "Nenhum commit encontrado";
  return commits
    .map(commit => [
      `${commit.hash.slice(0, 10)} ${commit.subject}`,
      `Author: ${commit.author}`,
      `Date:   ${commit.date}`,
      commit.body ? `\n${commit.body}` : ""
    ].join("\n"))
    .join("\n\n");
}
