/*---------------------------------------------------------------------------------------------
- Copyright (c) CorelabsBR. All rights reserved.
- Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
import { isSafeCustomShortcut, normalizeShortcut, shortcutFromEvent, type ShortcutBinding } from "../shortcuts/keybindings";
import { shortcutConflicts } from "../shortcuts/shortcutRegistry";
import { el } from "../utils/dom";
import { uiText } from "../../shared/i18n";

const CATEGORY_ORDER = ["Arquivo", "Busca", "Editor", "Visualizar", "Terminal", "Executar", "Controle de Origem", "Preferências", "Sharp-OSS"];

export interface KeyboardShortcutActions {
  create(commandId: string, key: string): Promise<readonly ShortcutBinding[]>;
  remove(commandId: string, key: string): Promise<readonly ShortcutBinding[]>;
}

export class KeyboardShortcutsModal {
  private overlay?: HTMLElement;

  constructor(private readonly updateStatus: (text: string) => void) {}

  get visible(): boolean {
    return Boolean(this.overlay?.isConnected);
  }

  show(shortcuts: readonly ShortcutBinding[], actions: KeyboardShortcutActions): void {
    this.close();

    const conflicts = shortcutConflicts(shortcuts);
    const overlay = el("div", { className: "keyboard-shortcuts-overlay" });
    const dialog = el("section", { className: "keyboard-shortcuts-modal", attrs: { "aria-label": "Atalhos de Teclado" } });
    const header = el("header", { className: "keyboard-shortcuts-header" });
    const title = el("div", { className: "keyboard-shortcuts-title" });
    title.append(el("h2", { text: "Atalhos de teclado" }), el("span", { text: uiText("{count} atalhos").replace("{count}", String(shortcuts.length)) }));
    const add = el("button", { className: "secondary", text: "Adicionar atalho", attrs: { type: "button" } });
    const close = el("button", { className: "icon-button", text: "×", attrs: { title: "Fechar" } });
    close.addEventListener("click", () => this.close());
    header.append(title, add, close);

    const customForm = this.createForm(shortcuts, actions);
    customForm.hidden = true;
    add.addEventListener("click", () => {
      customForm.hidden = !customForm.hidden;
      if (!customForm.hidden) customForm.querySelector<HTMLInputElement>("input")?.focus();
    });

    const search = el("input", { className: "panel-input", attrs: { placeholder: "Pesquisar por comando, categoria ou teclas" } });
    const conflictSummary = el("div", {
      className: "panel-summary",
      text: conflicts.size ? uiText("{count} conflito(s) de atalho detectado(s)").replace("{count}", String(conflicts.size)) : "Nenhum conflito de atalho"
    });
    const list = el("div", { className: "keyboard-shortcuts-list" });

    const render = () => {
      const query = search.value.trim().toLowerCase();
      list.replaceChildren();
      const visibleShortcuts = shortcuts.filter(shortcut => matches(shortcut, query));
      const grouped = groupByCategory(visibleShortcuts);
      for (const category of orderedCategories(grouped)) {
        const entries = grouped.get(category);
        if (!entries?.length) continue;
        const section = el("section", { className: "shortcut-category" });
        section.append(el("h3", { text: category }));
        for (const shortcut of entries) {
          const row = el("div", { className: "shortcut-row" });
          const copy = el("span", { className: "shortcut-copy" });
          const detail = shortcut.custom ? `${shortcut.description} · personalizado` : shortcut.description;
          copy.append(el("strong", { text: shortcut.label }), el("span", { text: detail }));
          const keys = el("span", { className: "shortcut-keys" });
          for (const key of shortcut.keys) {
            const isConflict = conflicts.has(key);
            keys.append(el("kbd", { className: isConflict ? "conflict" : "", text: key }));
          }
          row.append(copy, keys);
          if (shortcut.custom) {
            const remove = el("button", { className: "shortcut-remove", text: "Remover", attrs: { type: "button", title: "Remover atalho personalizado" } });
            remove.addEventListener("click", async () => {
              remove.setAttribute("disabled", "true");
              try {
                const next = await actions.remove(shortcut.commandId ?? shortcut.id, shortcut.keys[0]);
                this.show(next, actions);
              } catch (error) {
                remove.removeAttribute("disabled");
                this.updateStatus(`Não foi possível remover o atalho: ${error instanceof Error ? error.message : String(error)}`);
              }
            });
            row.append(remove);
          }
          section.append(row);
        }
        list.append(section);
      }
      if (!list.childElementCount) {
        list.append(el("div", { className: "muted-row", text: "Nenhum atalho encontrado." }));
      }
    };

    search.addEventListener("input", render);
    search.addEventListener("keydown", event => {
      if (event.key === "Escape") this.close();
    });
    overlay.addEventListener("keydown", event => {
      if (event.key === "Escape") this.close();
    });
    overlay.addEventListener("click", event => {
      if (event.target === overlay) this.close();
    });

    dialog.append(header, customForm, search, conflictSummary, list);
    overlay.append(dialog);
    document.body.append(overlay);
    this.overlay = overlay;
    render();
    search.focus();
    this.updateStatus("Atalhos de Teclado abertos");
  }

  close(): void {
    this.overlay?.remove();
    this.overlay = undefined;
  }

  private createForm(shortcuts: readonly ShortcutBinding[], actions: KeyboardShortcutActions): HTMLFormElement {
    const form = el("form", { className: "shortcut-editor" }) as HTMLFormElement;
    const command = document.createElement("select");
    command.className = "panel-input";
    const commands = shortcuts
      .filter(shortcut => !shortcut.custom)
      .sort((left, right) => left.label.localeCompare(right.label, "pt-BR"));
    for (const shortcut of commands) {
      const option = document.createElement("option");
      option.value = shortcut.commandId ?? shortcut.id;
      option.textContent = uiText(shortcut.label);
      command.append(option);
    }
    const key = el("input", { className: "panel-input", attrs: { placeholder: "Ex.: Ctrl+Alt+K", "aria-label": "Novo atalho" } }) as HTMLInputElement;
    const validation = el("span", { className: "shortcut-editor-error" });
    const submit = el("button", { text: "Salvar", attrs: { type: "submit" } }) as HTMLButtonElement;
    form.append(command, key, submit, validation);

    key.addEventListener("keydown", event => {
      if (event.key === "Enter" && key.value) return;
      if (event.key === "Backspace" || event.key === "Delete") {
        key.value = "";
        return;
      }
      const captured = shortcutFromEvent(event);
      if (!captured) return;
      event.preventDefault();
      const previous = normalizeShortcut(key.value);
      key.value = previous && !previous.includes(" ") && previous !== captured
        ? `${previous} ${captured}`
        : captured;
    });
    form.addEventListener("submit", async event => {
      event.preventDefault();
      const normalized = normalizeShortcut(key.value);
      if (!isSafeCustomShortcut(normalized)) {
        validation.textContent = "Use Ctrl, Alt ou Shift (ou uma tecla F1–F12).";
        return;
      }
      if (shortcutConflicts(shortcuts).has(normalized) || shortcuts.some(shortcut => shortcut.keys.includes(normalized))) {
        validation.textContent = `O atalho ${normalized} já está em uso.`;
        return;
      }
      validation.textContent = "";
      submit.disabled = true;
      try {
        const next = await actions.create(command.value, normalized);
        this.show(next, actions);
      } catch (saveError) {
        submit.disabled = false;
        const message = saveError instanceof Error ? saveError.message : String(saveError);
        validation.textContent = `Não foi possível salvar: ${message}`;
      }
    });
    return form;
  }
}

function matches(shortcut: ShortcutBinding, query: string): boolean {
  if (!query) return true;
  return [
    shortcut.label,
    shortcut.description,
    shortcut.category,
    ...shortcut.keys
  ].join(" ").toLowerCase().includes(query);
}

function groupByCategory(shortcuts: readonly ShortcutBinding[]): Map<string, ShortcutBinding[]> {
  const grouped = new Map<string, ShortcutBinding[]>();
  for (const shortcut of shortcuts) {
    grouped.set(shortcut.category, [...(grouped.get(shortcut.category) ?? []), shortcut]);
  }
  return grouped;
}

function orderedCategories(grouped: ReadonlyMap<string, ShortcutBinding[]>): string[] {
  const remaining = [...grouped.keys()].filter(category => !CATEGORY_ORDER.includes(category)).sort((left, right) => left.localeCompare(right, "pt-BR"));
  return [...CATEGORY_ORDER.filter(category => grouped.has(category)), ...remaining];
}
