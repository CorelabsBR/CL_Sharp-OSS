/*---------------------------------------------------------------------------------------------
- Copyright (c) CorelabsBR. All rights reserved.
- Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
import { basename } from "../utils/path";
import { el, icon } from "../utils/dom";

export interface CommandCenterAction {
  id: string;
  label: string;
  detail: string;
  iconName: string;
  disabled?: boolean;
  run: () => void;
}

export interface CommandCenterShortcut {
  label: string;
  keys: string;
}

export interface CommandCenterState {
  visible: boolean;
  actions: CommandCenterAction[];
  recentWorkspaces: string[];
  shortcuts: CommandCenterShortcut[];
}

export class CommandCenter {
  readonly element = el("section", { className: "command-center", attrs: { "aria-label": "Centro de Comando" } });
  private state: CommandCenterState = { visible: false, actions: [], recentWorkspaces: [], shortcuts: [] };

  constructor(private readonly openWorkspace: (workspace: string) => void) {
    this.render();
  }

  setState(state: CommandCenterState): void {
    this.state = state;
    this.render();
  }

  private render(): void {
    this.element.hidden = !this.state.visible;
    this.element.replaceChildren();
    if (!this.state.visible) return;

    const shell = el("div", { className: "command-center-shell" });
    const header = el("header", { className: "command-center-header" });
    header.append(
      el("span", { className: "command-center-kicker", text: "CENTRAL DE COMANDOS" }),
      el("h1", { text: "NPSharp" }),
      el("p", { text: "Abra, rode e organize seu workspace sem sair do editor." })
    );

    const actionGrid = el("div", { className: "command-action-grid" });
    for (const action of this.state.actions) {
      const button = el("button", { className: "command-action", title: action.detail });
      button.disabled = Boolean(action.disabled);
      button.append(
        el("span", { className: "command-action-icon", children: [icon(action.iconName, action.label)] }),
        el("span", { className: "command-action-copy", children: [
          el("strong", { text: action.label }),
          el("span", { text: action.detail })
        ] })
      );
      button.addEventListener("click", () => action.run());
      actionGrid.append(button);
    }

    const content = el("div", { className: "command-center-content" });
    content.append(this.recentProjects(), this.recentWorkspaces(), this.shortcuts());
    shell.append(header, actionGrid, content);
    this.element.append(shell);
  }

  private recentProjects(): HTMLElement {
    const section = commandSection("Projetos recentes");
    const list = el("div", { className: "command-recent-list" });
    const workspaces = this.state.recentWorkspaces.slice(0, 5);
    if (!workspaces.length) {
      list.append(el("div", { className: "command-empty", text: "Nenhum projeto recente ainda." }));
    }
    for (const workspace of workspaces) {
      const row = el("button", { className: "command-recent-row", title: workspace });
      row.append(
        icon("root-folder-opened", basename(workspace)),
        el("span", { className: "command-recent-copy", children: [
          el("strong", { text: basename(workspace) }),
          el("span", { text: workspace })
        ] })
      );
      row.addEventListener("click", () => this.openWorkspace(workspace));
      list.append(row);
    }
    section.append(list);
    return section;
  }

  private recentWorkspaces(): HTMLElement {
    const section = commandSection("Ultimos workspaces");
    const list = el("div", { className: "command-compact-list" });
    const workspaces = this.state.recentWorkspaces.slice(0, 8);
    if (!workspaces.length) {
      list.append(el("div", { className: "command-empty", text: "Abra uma pasta para iniciar o historico." }));
    }
    for (const workspace of workspaces) {
      const row = el("button", { className: "command-compact-row", title: workspace });
      row.append(el("span", { text: basename(workspace) }), el("small", { text: workspace }));
      row.addEventListener("click", () => this.openWorkspace(workspace));
      list.append(row);
    }
    section.append(list);
    return section;
  }

  private shortcuts(): HTMLElement {
    const section = commandSection("Atalhos recentes");
    const list = el("div", { className: "command-shortcut-list" });
    for (const shortcut of this.state.shortcuts) {
      list.append(el("div", { className: "command-shortcut", children: [
        el("span", { text: shortcut.label }),
        el("kbd", { text: shortcut.keys })
      ] }));
    }
    section.append(list);
    return section;
  }
}

function commandSection(title: string): HTMLElement {
  const section = el("section", { className: "command-section" });
  section.append(el("h2", { text: title }));
  return section;
}
