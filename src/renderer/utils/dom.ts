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
    ? folderIconForName(fileName, expanded)
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
function folderIconForName(folderName: string, expanded: boolean): string {

    const name = folderName.toLowerCase();

    const folders: Record<string, string> = {

        ".npsharp": "nps",
        "packages": "folder-packages",
        ".github": "folder-github",
        ".vscode": "vscode",
        "src": "folder-src",
        "public": "folder-public",
        "resources": "folder-resource",
        "assets": "assets",
        "scripts": "folder-scripts",
        "images": "folder-images",
        "android": "folder-android",
        "img": "folder-images",
        "js": "folder-javascript",
        "ts": "folder-typescript",
        "app": "folder-app",
        "apps": "folder-apps",
        "docs": "folder-docs",
        "core": "folder-core",
        "buildkite":"folder-buildkite",
        "admin": "folder-admin",
        "angular": "folder-angular",
        "animation": "folder-animation",
        "ansible": "folder-asnsible",
        "api": "folder-api",
        "apollo": "folder-apollo",
        "appwrite": "folder-appwrite",
        "archive": "folder-archive",
        "assembly": "folder-assembly",
        "astro": "folder-astro",
        "atom": "folder-atom",
        "attachment": "folder-attachment",
        "audio": "folder-audio",
        "aurelia": "folder-aurelia",
        "aws": "folder-aws",
        "config": "folder-config",
"azure-pipelines": "folder-azure-pipelines",
"backup": "folder-backup",
"base": "folder-base",
"batch": "folder-batch",
"benchmark": "folder-benchmark",
"bibliography": "folder-bibliography",
"bicep": "folder-bicep",
"blender": "folder-blender",
"bloc": "folder-bloc",
"bower": "folder-bower",
"cart": "folder-cart",
"changesets": "folder-changesets",
"ci": "folder-ci",
"circleci": "folder-circleci",
"class": "folder-class",
"claude": "folder-claude",
"client": "folder-client",
"cline": "folder-cline",
"cloudflare": "folder-cloudflare",
"cloud-functions": "folder-cloud-functions",
"cluster": "folder-cluster",
"cobol": "folder-cobol",
"command": "folder-command",
"components": "folder-components",
"connection": "folder-connection",
"console": "folder-console",
"constant": "folder-constant",
"container": "folder-container",
"content": "folder-content",
"context": "folder-context",
"contract": "folder-contract",
"controller": "folder-controller",
"coverage": "folder-coverage",
"css": "folder-css",
"cue": "folder-cue",
"cursor": "folder-cursor",
"custom": "folder-custom",
"cypress": "folder-cypress",
"dal": "folder-dal",
"dart": "folder-dart",
"database": "folder-database",
"debug": "folder-debug",
"decorators": "folder-decorators",
"delta": "folder-delta",
"desktop": "folder-desktop",
"directive": "folder-directive",
"dist": "folder-dist",
"docker": "folder-docker",
"download": "folder-download",
"drizzle": "folder-drizzle",
"dump": "folder-dump",
"element": "folder-element",
"enum": "folder-enum",
"environment": "folder-environment",
"error": "folder-error",
"eslint": "folder-eslint",
"event": "folder-event",
"examples": "folder-examples",
"expo": "folder-expo",
"export": "folder-export",
"fastlane": "folder-fastlane",
"favicon": "folder-favicon",
"features": "folder-features",
"filter": "folder-filter",
"firebase": "folder-firebase",
"firestore": "folder-firestore",
"flow": "folder-flow",
"flutter": "folder-flutter",
"font": "folder-font",
"forgejo": "folder-forgejo",
"form": "folder-form",
"functions": "folder-functions",
"gamemaker": "folder-gamemaker",
"gemini-ai": "folder-gemini-ai",
"generator": "folder-generator",
"gh-workflows": "folder-gh-workflows",
"gitea": "folder-gitea",
"github": "folder-github",
"gitlab": "folder-gitlab",
"git": "folder-git",
"global": "folder-global",
"godot": "folder-godot",
"go": "folder-go",
"gradle": "folder-gradle",
"graphql": "folder-graphql",
"guard": "folder-guard",
"gulp": "folder-gulp",
"helm": "folder-helm",
"helper": "folder-helper",
"home": "folder-home",
"hook": "folder-hook",
"husky": "folder-husky",
"i18n": "folder-i18n",
"import": "folder-import",
"include": "folder-include",
"input": "folder-input",
"interceptor": "folder-interceptor",
"interface": "folder-interface",
"ios": "folder-ios",
"java": "folder-java",
"javascript": "folder-javascript",
"jinja": "folder-jinja",
"job": "folder-job",
"json": "folder-json",
"jupyter": "folder-jupyter",
"keys": "folder-keys",
"kotlin": "folder-kotlin",
"kubernetes": "folder-kubernetes",
"kusto": "folder-kusto",
"layout": "folder-layout",
"lefthook": "folder-lefthook",
"less": "folder-less",
"lib": "folder-lib",
"license": "folder-license",
"link": "folder-link",
"linux": "folder-linux",
"liquibase": "folder-liquibase",
"log": "folder-log",
"lottie": "folder-lottie",
"lua": "folder-lua",
"luau": "folder-luau",
"macos": "folder-macos",
"mail": "folder-mail",
"mappings": "folder-mappings",
"markdown": "folder-markdown",
"mercurial": "folder-mercurial",
"messages": "folder-messages",
"meta": "folder-meta",
"metro": "folder-metro",
"middleware": "folder-middleware",
"migrations": "folder-migrations",
"mjml": "folder-mjml",
"mobile": "folder-mobile",
"mock": "folder-mock",
"mojo": "folder-mojo",
"molecule": "folder-molecule",
"moon": "folder-moon",
"netlify": "folder-netlify",
"next": "folder-next",
"nginx": "folder-nginx",
"ngrx-store": "folder-ngrx-store",
"node": "folder-node",
"nuxt": "folder-nuxt",
"obsidian": "folder-obsidian",
"opencode": "folder-opencode",
"organism": "folder-organism",
"other": "folder-other",
"pdf": "folder-pdf",
"pdm": "folder-pdm",
"phpmailer": "folder-phpmailer",
"php": "folder-php",
"pipe": "folder-pipe",
"plastic": "folder-plastic",
"plugin": "folder-plugin",
"policy": "folder-policy",
"postman": "folder-postman",
"powershell": "folder-powershell",
"prisma": "folder-prisma",
"private": "folder-private",
"project": "folder-project",
"prompts": "folder-prompts",
"proto": "folder-proto",
"python": "folder-python",
"pytorch": "folder-pytorch",
"quasar": "folder-quasar",
"queue": "folder-queue",
"react-components": "folder-react-components",
"redux-reducer": "folder-redux-reducer",
"repository": "folder-repository",
"resolver": "folder-resolver",
"resource": "folder-resource",
"review": "folder-review",
"robot": "folder-robot",
"root": "folder-root",
"r": "folder-r",
"routes": "folder-routes",
"rules": "folder-rules",
"rust": "folder-rust",
"salt": "folder-salt",
"sandbox": "folder-sandbox",
"sass": "folder-sass",
"scala": "folder-scala",
"scons": "folder-scons",
"secure": "folder-secure",
"seeders": "folder-seeders",
"serverless": "folder-serverless",
"server": "folder-server",
"shader": "folder-shader",
"shared": "folder-shared",
"simulations": "folder-simulations",
"skills": "folder-skills",
"snapcraft": "folder-snapcraft",
"snippet": "folder-snippet",
"src-tauri": "folder-src-tauri",
"stack": "folder-stack",
"stencil": "folder-stencil",
"store": "folder-store",
"storybook": "folder-storybook",
"stylus": "folder-stylus",
"sublime": "folder-sublime",
"supabase": "folder-supabase",
"svelte": "folder-svelte",
"svg": "folder-svg",
"syntax": "folder-syntax",
"target": "folder-target",
"taskfile": "folder-taskfile",
"tasks": "folder-tasks",
"television": "folder-television",
"template": "folder-template",
"temp": "folder-temp",
"terraform": "folder-terraform",
"test": "folder-test",
"theme": "folder-theme",
"toc": "folder-toc",
"tools": "folder-tools",
"trash": "folder-trash",
"trigger": "folder-trigger",
"turborepo": "folder-turborepo",
"typescript": "folder-typescript",
"ui": "folder-ui",
"unity": "folder-unity",
"update": "folder-update",
"upload": "folder-upload",
"utils": "folder-utils",
"vercel": "folder-vercel",
"verdaccio": "folder-verdaccio",
"video": "folder-video",
"views": "folder-views",
"vm": "folder-vm",
"vscode": "folder-vscode",
"vue-directives": "folder-vue-directives",
"vue": "folder-vue",
"vuepress": "folder-vuepress",
"vuex-store": "folder-vuex-store",
"wakatime": "folder-wakatime",
"webpack": "folder-webpack",
"windows": "folder-windows",
"wordpress": "folder-wordpress",
"yarn": "folder-yarn",
"zeabur": "folder-zeabur",
"zed": "folder-zed"
    };

const icon = folders[name] ?? "folder";

if (icon === "nps") {
    return "nps.png";
}

return expanded
    ? `${icon}-open.svg`
    : `${icon}.svg`;
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
    png: "imagepng.svg",
    jpg: "imagejpg.svg",
    jpeg: "image.svg",
    aac: "audio.svg",
    webp: "imagewebp.svg",
    gif: "imagegif.svg",
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
    "deb": "zip.svg",
    "der": "certificate.svg",
    "dlang": "d.svg",
    "dmg": "disc.svg",
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
