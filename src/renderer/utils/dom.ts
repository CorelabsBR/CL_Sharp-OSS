import { cssUrl, resourceUrl } from "./assets";

const contextMenuCleanup = Symbol("contextMenuCleanup");

type ManagedContextMenu = HTMLElement & {
  [contextMenuCleanup]?: () => void;
};

export interface ElementOptions {
  className?: string;
  text?: string;
  title?: string;
  attrs?: Record<string, string>;
  children?: Array<Node | string | undefined | null>;
}

export function el<K extends keyof HTMLElementTagNameMap>(tag: K, options: ElementOptions = {}): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  if (options.className) node.className = options.className;
  if (options.text !== undefined) node.textContent = options.text;
  if (options.title) node.title = options.title;
  for (const [key, value] of Object.entries(options.attrs ?? {})) {
    node.setAttribute(key, value);
  }
  for (const child of options.children ?? []) {
    if (child == null) continue;
    node.append(typeof child === "string" ? document.createTextNode(child) : child);
  }
  return node;
}

export function icon(name: string, title = name): HTMLElement {
  const span = el("span", { className: "codicon-mask", title });
  span.style.setProperty("--icon-url", cssUrl(resourceUrl(`codicons/${name}.svg`)));
  return span;
}

export function fileIcon(fileName: string, directory = false, expanded = false): HTMLElement {
  const span = el("span", { className: "file-icon" });
  const iconName = directory
    ? (expanded ? "folder-open-dark.svg" : "folder-dark.svg")
    : iconForFile(fileName);
  span.style.setProperty("--file-icon-url", cssUrl(resourceUrl(`fileicons/icons/${iconName}`)));
  return span;
}

export function buttonIcon(iconName: string, title: string, action: () => void): HTMLButtonElement {
  const button = el("button", { className: "icon-button", title, children: [icon(iconName, title)] });
  button.addEventListener("click", event => {
    event.stopPropagation();
    action();
  });
  return button;
}

export function contextMenu(items: Array<{ label: string; action: () => void; disabled?: boolean; danger?: boolean }>, x: number, y: number): HTMLElement {
  closeContextMenus();
  const menu = el("div", { className: "context-menu" });
  menu.style.left = `${x}px`;
  menu.style.top = `${y}px`;
  const close = installContextMenuDismiss(menu);
  for (const item of items) {
    const row = el("button", { className: `menu-row ${item.danger ? "danger" : ""}`, text: item.label });
    row.disabled = Boolean(item.disabled);
    row.addEventListener("click", () => {
      close();
      item.action();
    });
    menu.append(row);
  }
  document.body.append(menu);
  return menu;
}

export function closeContextMenus(): void {
  document.querySelectorAll<ManagedContextMenu>(".context-menu").forEach(menu => {
    menu[contextMenuCleanup]?.();
    menu.remove();
  });
}

export function installContextMenuDismiss(menu: HTMLElement): () => void {
  const managed = menu as ManagedContextMenu;
  managed[contextMenuCleanup]?.();
  const controller = new AbortController();
  const close = () => {
    controller.abort();
    menu.remove();
  };
  const closeOnPointerDown = (event: PointerEvent) => {
    const target = event.target;
    if (target instanceof Node && menu.contains(target)) return;
    close();
  };
  document.addEventListener("pointerdown", closeOnPointerDown, { capture: true, signal: controller.signal });
  managed[contextMenuCleanup] = () => controller.abort();
  return close;
}

function iconForFile(fileName: string): string {
  const lower = fileName.toLowerCase();
  const ext = lower.includes(".") ? lower.slice(lower.lastIndexOf(".") + 1) : "";
  const names: Record<string, string> = {
    java: "java.svg",
    py: "python.svg",
    js: "js.svg",
    mjs: "js.svg",
    cjs: "js.svg",
    ts: "typescript.svg",
    tsx: "reactts.svg",
    jsx: "reactjs.svg",
    json: "json.svg",
    html: "html.svg",
    htm: "html.svg",
    css: "css.svg",
    scss: "sass.svg",
    md: "markdown.svg",
    xml: "xml.svg",
    yaml: "yaml.svg",
    yml: "yaml.svg",
    toml: "toml.svg",
    properties: "properties.svg",
    sh: "shell.svg",
    ps1: "powershell.svg",
    c: "c.svg",
    h: "cheader.svg",
    cpp: "cpp.svg",
    hpp: "hpp.svg",
    cs: "csharp.svg",
    go: "go.svg",
    rs: "rust.svg",
    php: "php.svg",
    rb: "ruby.svg",
    lua: "lua.svg",
    kt: "kotlin.svg",
    kts: "kotlin.svg",
    por: "prompt.svg",
    gol: "prompt.svg",
    alg: "prompt.svg",
    portugol: "prompt.svg"
  };
  if (lower === "pom.xml") return "maven.svg";
  if (lower === "package.json") return "npm.svg";
  return names[ext] ?? "document-dark.svg";
}
