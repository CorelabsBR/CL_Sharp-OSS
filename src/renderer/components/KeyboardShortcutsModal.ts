import type { ShortcutBinding } from "../shortcuts/keybindings";
import { shortcutConflicts } from "../shortcuts/shortcutRegistry";
import { el } from "../utils/dom";

const CATEGORY_ORDER = ["File", "Search", "Editor", "View", "Terminal", "Run", "Source Control", "Preferences", "NPSharp"];

export class KeyboardShortcutsModal {
  private overlay?: HTMLElement;

  constructor(private readonly updateStatus: (text: string) => void) {}

  get visible(): boolean {
    return Boolean(this.overlay?.isConnected);
  }

  show(shortcuts: readonly ShortcutBinding[]): void {
    this.close();

    const conflicts = shortcutConflicts(shortcuts);
    const overlay = el("div", { className: "keyboard-shortcuts-overlay" });
    const dialog = el("section", { className: "keyboard-shortcuts-modal", attrs: { "aria-label": "Keyboard Shortcuts" } });
    const header = el("header", { className: "keyboard-shortcuts-header" });
    const title = el("div", { className: "keyboard-shortcuts-title" });
    title.append(el("h2", { text: "Keyboard Shortcuts" }), el("span", { text: `${shortcuts.length} commands` }));
    const close = el("button", { className: "icon-button", text: "x", attrs: { title: "Close" } });
    close.addEventListener("click", () => this.close());
    header.append(title, close);

    const search = el("input", { className: "panel-input", attrs: { placeholder: "Search by command, category, or keys" } });
    const conflictSummary = el("div", {
      className: "panel-summary",
      text: conflicts.size ? `${conflicts.size} shortcut conflict(s) detected` : "No shortcut conflicts"
    });
    const list = el("div", { className: "keyboard-shortcuts-list" });

    const render = () => {
      const query = search.value.trim().toLowerCase();
      list.replaceChildren();
      const visibleShortcuts = shortcuts.filter(shortcut => matches(shortcut, query));
      const grouped = groupByCategory(visibleShortcuts);
      for (const category of CATEGORY_ORDER) {
        const entries = grouped.get(category);
        if (!entries?.length) continue;
        const section = el("section", { className: "shortcut-category" });
        section.append(el("h3", { text: category }));
        for (const shortcut of entries) {
          const row = el("div", { className: "shortcut-row" });
          const copy = el("span", { className: "shortcut-copy" });
          copy.append(el("strong", { text: shortcut.label }), el("span", { text: shortcut.description }));
          const keys = el("span", { className: "shortcut-keys" });
          for (const key of shortcut.keys) {
            const isConflict = conflicts.has(key);
            keys.append(el("kbd", { className: isConflict ? "conflict" : "", text: key }));
          }
          row.append(copy, keys);
          section.append(row);
        }
        list.append(section);
      }
      if (!list.childElementCount) {
        list.append(el("div", { className: "muted-row", text: "No shortcuts found." }));
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

    dialog.append(header, search, conflictSummary, list);
    overlay.append(dialog);
    document.body.append(overlay);
    this.overlay = overlay;
    render();
    search.focus();
    this.updateStatus("Keyboard Shortcuts aberto");
  }

  close(): void {
    this.overlay?.remove();
    this.overlay = undefined;
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
