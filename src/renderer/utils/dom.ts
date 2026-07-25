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
    rb: "ruby.svg",
    lua: "lua.svg",
    kt: "kotlin.svg",
    kts: "kotlin.svg",
    por: "prompt.svg",
    gol: "prompt.svg",
    alg: "prompt.svg",
    portugol: "prompt.svg",
    lock: "lock.svg",
    env: "env.svg",
    png: "image.svg",
    jpg: "image.svg",
    jpeg: "image.svg",
    aac: "audio.svg",
    webp: "image.svg",
    gif: "image.svg",
    bmp: "image.svg",
    svg: "image.svg",
    mp3: "audio.svg",
    wav: "audio.svg",
    flac: "audio.svg",
    ogg: "audio.svg",
    mp4: "video.svg",
    mkv: "video.svg",
    avi: "video.svg",
    mov: "video.svg",
    wmv: "video.svg",
    blade: "blade.svg",
    php: "php.svg",
    pem: "cert.svg",
    aab: "android.svg",
    apk: "android.svg",
    ipa: "applescript.svg",
    zip: "zip.svg",
    gz: "zip.svg",
    rar: "zip.svg",
    xz: "zip.svg",
    tar: "zip.svg",
    iso: "iso.png",
    img: "iso.png",
    "7z": "zip.svg",
     zst: "zip.svg",
    gradle: "gradle.svg",
    crt: "key.svg",
    "blade.php":"blade.svg",
    key: "key.svg",
    cc: "cpp.svg",
    cp: "cpp.svg",
    cfg: "conf.svg",
    conf: "conf.svg",
    config: "conf.svg",
    ini: "conf.svg",
    log: "log.svg",
    bat: "bat.svg",
    cmd: "bat.svg",
    ico: "imageico.svg",
    astro: "astro.svg",
    asm: "assembly.svg",
    bin: "binary.svg",
    dart: "dartlang.svg",
    db: "database.svg",
    sql: "database.svg",
    editorconfig: "nps.png",
    fs: "fsharp.svg",
    gitattributes: "git.svg",
    gitignore: "git.svg",
    groovy: "groovy.svg",
    hh: "cheader.svg",
    ipynb: "ipynb.svg",
    jsonc: "json.svg",
    less: "less.svg",
    m: "m.svg",
    mm: "m.svg",
    r: "r.svg",
    s: "assembly.svg",
    sass: "sass.svg",
    scala: "scala.svg",
    sqlite: "sqlite.svg",
    sqlite3: "sqlite.svg",
    svelte: "svelte.svg",
    swift: "swift.svg",
    txt: "txt.svg",
    andy: "sakura.png",
    vb: "vb.svg",
    vbproj:"vbproj.svg",
    vue: "vue.svg",
    otf: "fontotf.svg",
    ttf: "fontttf.svg",
    woff: "fontwoff.svg",
    woff2: "fontwoff2.svg",
    avif: "image.svg",
    heic: "image.svg",
    icns: "applescript.svg",
    tif: "image.svg",
    tiff: "image.svg",
    "p12": "key.svg",
    pfx: "cert.svg",
    dll: "dll.svg",
    dylib: "dll.svg",
    so: "dll.svg",
    exe: "binary.svg",
    webm: "video.svg",
    "3d": "3d.svg",
    "3ds": "3d.svg",
    aabx: "android.svg",
    accdb: "database.svg",
    adoc: "asciidoc.svg",
    ai: "adobe-illustrator.svg",
    apkx: "android.svg",
    abap: "abap.svg",
ada: "ada.svg",
bazel: "bazel.svg",
cabal: "cabal.svg",
clj: "clojure.svg",
clojure: "clojure.svg",
coffee: "coffee.svg",
cobol: "cobol.svg",
cr: "crystal.svg",
crystal: "crystal.svg",
cuda: "cuda.svg",
diff: "diff.svg",
elixir: "elixir.svg",
elm: "elm.svg",
erb: "erb.svg",
erl: "erlang.svg",
ex: "elixir.svg",
exs: "exs.svg",
fortran: "fortran.svg",
fth: "forth.svg",
g4: "antlr.svg",
gd: "godot.svg",
glsl: "shader.svg",
graphql: "graphql.svg",
hs: "haskell.svg",
hcl: "hcl.svg",
hx: "haxe.svg",
jl: "julia.svg",
lisp: "lisp.svg",
lsp: "lisp.svg",
matlab: "matlab.svg",
nim: "nim.svg",
nix: "nix.svg",
pas: "pascal.svg",
perl: "perl.svg",
pl: "perl.svg",
proto: "proto.svg",
prolog: "prolog.svg",
pug: "pug.svg",
rkt: "racket.svg",
raku: "raku.svg",
sol: "sol.svg",
solidity: "solidity.svg",
tcl: "tcl.svg",
tex: "tex.svg",
v: "v.svg",
vala: "vala.svg",
vhdl: "vhdl.svg",
wgsl: "wgsl.svg",
zig: "zig.svg",
    appimage: "binary.svg",
    appx: "binary.svg",
    "appxbundle": "binary.svg",
    "asc": "certificate.svg",
    "asciidoc": "asciidoc.svg",
       asp: "html.svg",
    aspx: "html.svg",
    "avro": "database.svg",
    "azw": "book.svg",

    "babelrc": "babel.svg",
    "bash": "shell.svg",
    "bib": "bibtex-style.svg",
    "blend": "blender.svg",
    "browserlist": "browserlist.svg",
    "browserslistrc": "browserlist.svg",
    "chart": "file.svg",
    "chm": "document.svg",
    "cljc": "clojure.svg",
    "cljs": "clojure.svg",
    "cmake": "cmake.svg",
    "crontab": "shell.svg",
    "cshtml": "cshtml.svg",
    "csproj": "csproj.svg",
    "csv": "csv.svg",

    "d": "d.svg",
    "dae": "3d.svg",
    "db3": "database.svg",
    "deb": "linux.svg",
    "der": "certificate.svg",
    "desktop": "linux.svg",
    "dlang": "d.svg",
    "dmg": "apple.svg",
    "dng": "image.svg",
    "dockerignore": "docker.svg",
    "dwg": "3d.svg",
    "dxf": "3d.svg",

    "editorconfig-example": "editorconfig.svg",
    "el": "lisp.svg",
    "env.example": "env.svg",
    "eps": "image.svg",
    "epub": "epub.svg",
    "eslintrc": "eslint.svg",

    "fbx": "3d.svg",
    "feather": "database.svg",
    "figma": "figma.svg",
    "fish": "shell.svg",
    "flatpak": "shell.svg",
    "fsproj": "fsharp.svg",
    "gcode": "file.svg",
    "gitattributes2": "git.svg",
    "gitkeep": "git.svg",
    "gitmessage": "git.svg",
    "gitmodules": "git.svg",
    "glb": "3d.svg",
    "gltf": "3d.svg",
    "gql": "graphql.svg",
    "gradle.kts": "gradlekotlin.svg",
    "helm": "helm.svg",
    "hrll": "file.svg",
    "htaccess": "apache.svg",

    "idr": "idris.svg",
    "iges": "3d.svg",
    "ignore": "git.svg",
    "igs": "3d.svg",
    "ini.bak": "conf.svg",
    "iso9660": "iso.png",

    "jks": "key.svg",
    "json5": "json.svg",
    "jsonl": "json.svg",
    "jsp": "jsp.svg",
    "jspx": "jsp.svg",

    "k8s": "kubernetes.svg",
    "keystore": "key.svg",
    "ksh": "shell.svg",
    "kube": "kubernetes.svg",

    "latex": "latex.svg",
    "lhs": "haskell.svg",
    "litcoffee": "coffee.svg",

    "map": "file.svg",
    "md5": "hash.svg",
    "mdb": "database.svg",
    "mdx": "mdx.svg",
    "ml": "ocaml.svg",
    "mli": "ocaml.svg",
    "mo": "file.svg",
    // "mobi": "book.svg",
    // "mount": "linux.svg",
    "move": "file.svg",
    "msix": "binary.svg",

    "nc": "file.svg",
    "ndjson": "json.svg",
    "ninja": "file.svg",
    "npmrc": "npm.svg",
    "nsis": "file.svg",
    "nu": "nushell.svg",

    "obj": "3d.svg",
    "odin": "odin.svg",
    "orc": "file.svg",
    "org": "file.svg",
    "ova": "virtual.svg",
    "ovf": "virtual.svg",

    "p7b": "certificate.svg",
    "p7c": "certificate.svg",
    "parquet": "database.svg",
    "patch": "diff.svg",
    "pdf": "pdf.svg",
    "php3": "php.svg",
    "php4": "php.svg",
    "php5": "php.svg",
    "phtml": "php.svg",
    "pkg": "package.svg",
    "pm": "perl.svg",
    "pnpmrc": "pnpm.svg",
    "po": "file.svg",
    "pot": "file.svg",
    "prettierrc": "prettier.svg",
    "prisma": "prisma.svg",
    "proj": "file.svg",
    "props": "file.svg",

    "psb": "photoshop.svg",
    "psd1": "powershell.svg",
    "psm1": "powershell.svg",
    "pub": "key.svg",
    "qcow2": "virtual.svg",
    "raw": "image.svg",
    "razor": "razor.svg",
    "rpm": "linux.svg",
    "rst": "restructuredtext.svg",
    "service": "systemd.svg",
    "sha1": "hash.svg",
    "sha256": "hash.svg",
    "sha512": "hash.svg",
    "sig": "certificate.svg",
    "sketch": "sketch.svg",
    "sln": "sln.svg",
    "snap": "linux.svg",
    "socket": "linux.svg",
    "spec": "file.svg",
    "sql.gz": "database.svg",
    "sqlite2": "sqlite.svg",
    "step": "3d.svg",
    "stl": "3d.svg",
    "store": "file.svg",
    "stp": "3d.svg",
    "sty": "latex.svg",
    "stylelintrc": "stylelint.svg",
    "sv": "verilog.svg",
    "sveltekit": "svelte.svg",

    "svgz": "svg.svg",
    "tf": "terraform.svg",
    "tfvars": "terraform.svg",
    "thrift": "file.svg",
    "toml.example": "toml.svg",
    "tsv": "csv.svg",

    "vcxproj": "cpp.svg",
    "vdi": "virtual.svg",
    "verilog": "verilog.svg",
    "vhd": "vhdl.svg",
    "vhdx": "virtual.svg",
    "vmdk": "virtual.svg",
    "vscodeignore": "vscode.svg",
    "vuepress": "vue.svg",

    "wasm": "wasm.svg",
    "wat": "wasm.svg",
    "webmanifest": "json.svg",
    "wixproj": "file.svg",

    "xapk": "android.svg",
    "xcf": "image.svg",
    "xml.in": "xml.svg",
    "xml.template": "xml.svg",

    "yaml.template": "yaml.svg",
    "yarnrc": "yarn.svg",
    "yml.template": "yaml.svg",
    "zsh": "shell.svg",


    

    


  };
  if (lower === "pom.xml") return "maven.svg";
  if (lower === "package.json") return "npm.svg";
  if (lower === ".env.example") return "env.svg";
  if (lower === ".env") return "env.svg";
  if (lower === ".gitignore") return "git.svg";
  if (lower === ".gitattributes") return "git.svg";
  if (lower === ".editorconfig") return "nps.png";
  if (lower === "license.md") return "key.svg";
  if (lower === "license") return "license.svg";
  if (lower === "artisan") return "laravel.png";
  if (lower === ".npsharp") return "nps.png";
  if (lower === "package.json") return "npm.svg";
  if (lower === "cargo.lock") return "cargolock.svg";
  if (lower === "dockerfile") return "docker.svg";
  if (lower === "docker-compose.yml") return "docker.svg";
  if (lower === "docker-compose.yaml") return "docker.svg";
  if (lower === "docker-compose.override.yml") return "docker.svg";
  if (lower === "docker-compose.override.yaml") return "docker.svg";
  if (lower === "docker-compose.override") return "docker.svg";
  if (lower === "docker-compose") return "docker.svg";
  if (lower === "dockerfile.dev") return "docker.svg";
  if (lower === "dockerfile.prod") return "docker.svg";
  if (lower === "dockerfile.test") return "docker.svg";
  if (lower === "readme") return "markdown.svg";
  if (lower === "codeowners") return "markdown.svg";
  if (lower === "gemfile") return "ruby.svg";
  if (lower === "go.mod") return "go.svg";
  if (lower === "go.sum") return "go.svg";
  if (lower === "makefile") return "makefile.svg";
  if (lower === "pipfile") return "python.svg";
  if (lower === "rakefile") return "ruby.svg";





  return names[ext] ?? "document-dark.svg";
}
