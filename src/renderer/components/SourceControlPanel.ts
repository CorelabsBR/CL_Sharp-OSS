import type { GitCommit, GitFileStatus, GitRepositoryStatus } from "../../shared/types";
import { api, platform } from "../services/api";
import { buttonIcon, el, fileIcon } from "../utils/dom";
import { reportError } from "../utils/errors";

export class SourceControlPanel {
  readonly element = el("div", { className: "panel scm-panel" });
  private readonly summary = el("div", { className: "panel-summary", text: "No repository" });
  private readonly commitInput = el("input", { className: "panel-input", attrs: { placeholder: "Commit message" } });
  private readonly allowEmpty = el("input", { attrs: { type: "checkbox" } });
  private readonly list = el("div", { className: "scm-list" });
  private readonly gitActions: HTMLButtonElement[] = [];
  private workspace?: string;
  private repos: GitRepositoryStatus[] = [];

  constructor(
    private readonly openVirtualFile: (title: string, uri: string, content: string) => void,
    private readonly updateStatus: (text: string) => void
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
      this.summary.textContent = "Open a folder to use source control";
      return;
    }
    try {
      this.summary.textContent = "Scanning repositories...";
      this.repos = await api.git.status(this.workspace);
      this.render();
    } catch (error) {
      this.summary.textContent = reportError(error, this.updateStatus, "Source control refresh failed");
    }
  }

  async runOnFirstRepo(args: string[]): Promise<void> {
    if (!platform.canUseGit) {
      this.updateStatus(platform.isMobile ? "Git nativo ainda nao esta disponivel no mobile." : "Git local nao esta disponivel neste modo.");
      return;
    }
    const repo = this.repos[0];
    if (!repo) return;
    const result = await api.git.run(repo.repo, args);
    this.updateStatus(result.output || (result.success ? "Git operation complete" : "Git operation failed"));
    await this.refresh();
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
    const refresh = buttonIcon("refresh", "Refresh", () => void this.refresh());
    const stageAll = buttonIcon("add", "Stage All", () => void this.stageAll());
    const unstageAll = buttonIcon("remove", "Unstage All", () => void this.unstageAll());
    const commit = buttonIcon("check", "Commit", () => void this.commitAll());
    const pull = buttonIcon("repo-pull", "Pull", () => void this.runOnFirstRepo(["pull"]));
    const push = buttonIcon("repo-push", "Push", () => void this.runOnFirstRepo(["push"]));
    const fetch = buttonIcon("repo-fetch", "Fetch", () => void this.runOnFirstRepo(["fetch"]));
    this.gitActions.push(stageAll, unstageAll, commit, pull, push, fetch);
    toolbar.append(refresh, stageAll, unstageAll, commit, pull, push, fetch);
    this.commitInput.addEventListener("keydown", event => {
      if (event.key === "Enter") void this.commitAll();
    });
    const allowEmptyRow = el("label", { className: "check-row" });
    allowEmptyRow.append(this.allowEmpty, el("span", { text: "Allow empty commit" }));
    this.element.append(toolbar, this.summary, this.commitInput, allowEmptyRow, this.list);
    this.applyCapabilityState();
  }

  private render(): void {
    this.applyCapabilityState();
    const changes = this.repos.reduce((sum, repo) => sum + repo.files.length, 0);
    this.summary.textContent = this.repos.length === 0 ? "No Git repositories found" : `${this.repos.length} repo(s), ${changes} change(s)`;
    this.list.replaceChildren();
    for (const repo of this.repos) {
      const repoBlock = el("section", { className: "scm-repo" });
      const header = el("div", { className: "scm-repo-header" });
      header.append(
        el("strong", { text: repo.name }),
        el("span", { text: repo.branch }),
        el("span", { text: repo.ahead || repo.behind ? `↑${repo.ahead} ↓${repo.behind}` : "" }),
        buttonIcon("git-branch", "Branch", () => void this.chooseBranch(repo)),
        buttonIcon("history", "History", () => void this.showHistory(repo))
      );
      repoBlock.append(header);
      if (repo.clean) repoBlock.append(el("div", { className: "muted-row", text: "Working tree clean" }));
      for (const file of repo.files) repoBlock.append(this.fileRow(repo, file));
      this.list.append(repoBlock);
    }
  }

  private renderLimitedMode(): void {
    this.repos = [];
    this.applyCapabilityState();
    this.summary.textContent = platform.isMobile
      ? "Source Control mobile em modo limitado."
      : "Source Control limitado no modo web.";
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
    const disabled = !platform.canUseGit;
    for (const button of this.gitActions) button.disabled = disabled;
    this.commitInput.disabled = disabled;
    this.allowEmpty.disabled = disabled;
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
      buttonIcon(file.staged ? "remove" : "add", file.staged ? "Unstage" : "Stage", () => void this.stageToggle(repo, file)),
      buttonIcon("diff", "Diff", () => void this.showDiff(repo, file)),
      buttonIcon("debug-breakpoint-conditional", "Resolve Conflict", () => void this.resolveConflict(repo, file)),
      buttonIcon("discard", "Discard", () => void this.discard(repo, file))
    );
    actions.querySelector<HTMLButtonElement>('[title="Resolve Conflict"]')!.hidden = !file.conflicted;
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
//não só isso, mas se tu já olhou o código, tu já sabe, se não, vai catar, curioso!


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
    const result = file.staged ? await api.git.unstage(repo.repo, file) : await api.git.stage(repo.repo, file);
    this.updateStatus(result.output || (result.success ? "Git operation complete" : "Git operation failed"));
    await this.refresh();
  }

  private async discard(repo: GitRepositoryStatus, file: GitFileStatus): Promise<void> {
    if (!platform.canUseGit) return this.renderLimitedMode();
    if (!confirm(`Discard changes in ${file.path}?`)) return;
    const result = await api.git.discard(repo.repo, file);
    this.updateStatus(result.output || (result.success ? "Changes discarded" : "Discard failed"));
    await this.refresh();
  }

  private async commitAll(): Promise<void> {
    if (!platform.canUseGit) return this.renderLimitedMode();
    const message = this.commitInput.value.trim();
    const repo = this.repos[0];
    if (!repo || !message) return;
    const result = await api.git.commit(repo.repo, message, this.allowEmpty.checked);
    this.updateStatus(result.output || (result.success ? "Commit created" : "Commit failed"));
    if (result.success) this.commitInput.value = "";
    await this.refresh();
  }

  private async showDiff(repo: GitRepositoryStatus, file: GitFileStatus): Promise<void> {
    try {
      const diff = await api.git.diff(repo.repo, file, file.staged);
      this.openVirtualFile(`${file.path}.diff`, `git:${repo.repo}:${file.path}:${file.staged}`, diff || "No diff available");
    } catch (error) {
      reportError(error, this.updateStatus, `Git diff failed (${file.path})`);
    }
  }

  private async showHistory(repo: GitRepositoryStatus): Promise<void> {
    const commits = await api.git.history(repo.repo);
    this.openVirtualFile(`${repo.name} history`, `git:${repo.repo}:history`, formatHistory(commits));
  }

  private async chooseBranch(repo: GitRepositoryStatus): Promise<void> {
    const next = prompt(`Branch for ${repo.name}\nExisting: ${repo.branches.join(", ")}`, repo.branch);
    if (!next?.trim() || next.trim() === repo.branch) return;
    const branch = next.trim();
    const result = repo.branches.includes(branch)
      ? await api.git.checkout(repo.repo, branch)
      : confirm(`Create branch "${branch}" from ${repo.branch}?`)
        ? await api.git.createBranch(repo.repo, branch)
        : { success: false, output: "Branch operation cancelled" };
    this.updateStatus(result.output || (result.success ? "Branch operation complete" : "Branch operation failed"));
    await this.refresh();
  }

  private async resolveConflict(repo: GitRepositoryStatus, file: GitFileStatus): Promise<void> {
    if (!file.conflicted) {
      await this.showDiff(repo, file);
      return;
    }
    const choice = prompt(`Resolve ${file.path}: current, incoming, manual`, "manual")?.trim().toLowerCase();
    if (!choice || choice === "manual") {
      await this.showDiff(repo, file);
      return;
    }
    if (choice !== "current" && choice !== "incoming") {
      this.updateStatus("Conflict resolution cancelled");
      return;
    }
    const checkout = await api.git.run(repo.repo, ["checkout", choice === "current" ? "--ours" : "--theirs", "--", file.path]);
    if (!checkout.success) {
      this.updateStatus(checkout.output || "Conflict resolution failed");
      return;
    }
    const add = await api.git.stage(repo.repo, file);
    this.updateStatus(add.output || (add.success ? "Conflict resolved and staged" : "Conflict resolution failed"));
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
  if (commits.length === 0) return "No commits found";
  return commits
    .map(commit => [
      `${commit.hash.slice(0, 10)} ${commit.subject}`,
      `Author: ${commit.author}`,
      `Date:   ${commit.date}`,
      commit.body ? `\n${commit.body}` : ""
    ].join("\n"))
    .join("\n\n");
}
