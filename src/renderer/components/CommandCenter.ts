/*---------------------------------------------------------------------------------------------
- Copyright (c) CorelabsBR. All rights reserved.
- Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
import { basename } from "../utils/path";
import { el, icon } from "../utils/dom";
import { uiText } from "../../shared/i18n";
import { BUILD_CONFIG } from "../../shared/buildConfig";
import { DEFAULT_LOGO_URL } from "../utils/assets";

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
  readonly element = el("section", { className: "command-center", attrs: { "aria-label": uiText("Centro de Comando") } });
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
    const hero = el("header", { className: "command-center-hero" });
    const brand = el("div", { className: "command-center-brand", attrs: { "aria-hidden": "true" } });
    brand.append(
      el("span", { className: "command-brand-orbit" }),
      el("img", { attrs: { src: DEFAULT_LOGO_URL, alt: "" } })
    );
    const header = el("div", { className: "command-center-header" });
    header.append(
      el("span", { className: "command-center-kicker", text: uiText("CENTRAL DE COMANDOS") }),
      el("h1", { text: "Sharp-OSS" }),
      el("p", { text: uiText("Abra, rode e organize seu workspace sem sair do editor.") })
    );
    const meta = el("div", { className: "command-center-meta" });
    meta.append(
      el("span", { className: "command-meta-badge", text: uiText("IDE de código aberto") }),
      el("span", { className: "command-meta-version", text: `v${BUILD_CONFIG.version}` })
    );
    hero.append(brand, header, meta);

    const primaryIds = new Set(["open-folder", "new-file", "new-project", "clone"]);
    const primaryActions = this.state.actions.filter(action => primaryIds.has(action.id));
    const toolActions = this.state.actions.filter(action => !primaryIds.has(action.id));

    const quickStart = this.actionSection(
      "01",
      uiText("Início rápido"),
      uiText("Ações principais para começar."),
      primaryActions,
      false
    );
    const tools = this.actionSection(
      "02",
      uiText("Ferramentas"),
      uiText("Ambiente e produtividade."),
      toolActions,
      true
    );

    const content = el("div", { className: "command-center-content" });
    content.append(this.recentProjects(), this.shortcuts());
    shell.append(hero, quickStart, tools, content);
    this.element.append(shell);
  }

  private actionSection(index: string, title: string, description: string, actions: CommandCenterAction[], compact: boolean): HTMLElement {
    const section = commandSection(index, title, description);
    const actionGrid = el("div", { className: compact ? "command-tool-grid" : "command-action-grid" });
    for (const action of actions) {
      const button = el("button", {
        className: `command-action${compact ? " command-action-compact" : ""}`,
        title: action.detail,
        attrs: {
          type: "button",
          "data-action": action.id,
          "aria-label": `${action.label}: ${action.detail}`
        }
      });
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
    section.append(actionGrid);
    return section;
  }

  private recentProjects(): HTMLElement {
    const workspaces = this.state.recentWorkspaces.slice(0, 8);
    const section = commandSection("03", uiText("Projetos recentes"), uiText("Retome de onde parou."), String(workspaces.length));
    const list = el("div", { className: "command-recent-list" });
    if (!workspaces.length) {
      const empty = el("div", { className: "command-empty" });
      empty.append(
        el("span", { className: "command-empty-icon", children: [icon("root-folder-opened", uiText("Projetos recentes"))] }),
        el("span", { className: "command-empty-copy", children: [
          el("strong", { text: uiText("Nenhum projeto recente ainda.") }),
          el("span", { text: uiText("Abra uma pasta para iniciar o histórico.") })
        ] })
      );
      list.append(empty);
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

  private shortcuts(): HTMLElement {
    const section = commandSection("04", uiText("Atalhos essenciais"), uiText("Fluxos que ficam à mão."));
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

function commandSection(index: string, title: string, description: string, count?: string): HTMLElement {
  const section = el("section", { className: "command-section" });
  const heading = el("header", { className: "command-section-heading" });
  const copy = el("span", { className: "command-section-copy" });
  copy.append(el("h2", { text: title }), el("span", { text: description }));
  heading.append(el("span", { className: "command-section-index", text: index }), copy);
  if (count !== undefined) heading.append(el("span", { className: "command-section-count", text: count }));
  section.append(heading);
  return section;
}
