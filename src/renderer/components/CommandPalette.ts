import { el } from "../utils/dom";

export interface CommandAction {
  label: string;
  shortcut?: string;
  keywords?: string;
  run: () => void | Promise<void>;
}

export interface PaletteItem {
  label: string;
  hint?: string;
  active?: boolean;
  swatch?: string;
  run: () => void | Promise<void>;
}

export class CommandPalette {
  private commands: CommandAction[] = [];
  private quickOpenFiles: string[] = [];
  private openFile: (file: string) => void = () => undefined;

  setCommands(commands: CommandAction[]): void {
    this.commands = commands;
  }

  setWorkspace(_workspace?: string): void {
    // Quick open keeps recent/open files in this migration; workspace indexing is delegated to Search.
  }

  setQuickOpenFiles(files: string[]): void {
    this.quickOpenFiles = files;
  }

  setFileOpener(opener: (file: string) => void): void {
    this.openFile = opener;
  }

  showCommands(): void {
    this.show(">", this.commands.map(command => ({ label: command.label, hint: command.shortcut ?? "", run: command.run })));
  }

  showQuickOpen(): void {
    this.show("", this.quickOpenFiles.map(file => ({ label: file, hint: "", run: () => this.openFile(file) })));
  }

  showPicker(placeholder: string, items: PaletteItem[]): void {
    this.show("", items, placeholder);
  }

  private show(prefix: string, items: PaletteItem[], placeholder = "Type a command or file"): void {
    document.querySelector(".palette-overlay")?.remove();
    const overlay = el("div", { className: "palette-overlay" });
    const box = el("div", { className: "palette" });
    const input = el("input", { className: "palette-input", attrs: { value: prefix, placeholder } });
    const list = el("div", { className: "palette-list" });
    box.append(input, list);
    overlay.append(box);
    document.body.append(overlay);

    const render = () => {
      const query = input.value.replace(/^>/, "").trim().toLowerCase();
      list.replaceChildren();
      items
        .filter(item => item.label.toLowerCase().includes(query))
        .slice(0, 50)
        .forEach((item, index) => {
          const row = el("button", { className: `palette-row ${index === 0 ? "active" : ""} ${item.active ? "selected" : ""}`.trim() });
          const label = el("span", { className: "palette-label" });
          label.append(el("span", { className: "palette-check", text: item.active ? "✓" : "" }));
          if (item.swatch) {
            const swatch = el("span", { className: "palette-swatch" });
            swatch.style.background = item.swatch;
            label.append(swatch);
          }
          label.append(el("span", { className: "palette-text", text: item.label }));
          row.append(label, el("span", { className: "menu-shortcut", text: item.hint ?? "" }));
          row.addEventListener("click", () => {
            overlay.remove();
            void item.run();
          });
          list.append(row);
        });
    };
    input.addEventListener("input", render);
    input.addEventListener("keydown", event => {
      if (event.key === "Escape") overlay.remove();
      if (event.key === "Enter") {
        const first = list.querySelector<HTMLButtonElement>(".palette-row");
        first?.click();
      }
    });
    overlay.addEventListener("click", event => {
      if (event.target === overlay) overlay.remove();
    });
    render();
    input.focus();
  }
}
