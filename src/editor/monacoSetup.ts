/*---------------------------------------------------------------------------------------------
- Copyright (c) CorelabsBR. All rights reserved.
- Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
import * as monaco from "monaco-editor/editor";
// The minimal editor API does not include Codicon styles. The Find widget uses
// those glyphs for its controls (next/previous, replace and close).
import "monaco-editor/features/codicon/register.js";
// editor.api does not register the Find contribution; import it explicitly so
// Ctrl+F/Cmd+F and the title-bar command share Monaco's real Find widget.
import "monaco-editor/features/find/register.js";
import editorWorker from "monaco-editor/editor/editor.worker.js?worker";
import jsonWorker from "monaco-editor/language/json/json.worker.js?worker";
import cssWorker from "monaco-editor/language/css/css.worker.js?worker";
import htmlWorker from "monaco-editor/language/html/html.worker.js?worker";
import tsWorker from "monaco-editor/language/typescript/ts.worker.js?worker";

self.MonacoEnvironment = {
  getWorker(_workerId: string, label: string) {
    if (label === "json") return new jsonWorker();
    if (label === "css" || label === "scss" || label === "less") return new cssWorker();
    if (label === "html" || label === "handlebars" || label === "razor") return new htmlWorker();
    if (label === "typescript" || label === "javascript") return new tsWorker();
    return new editorWorker();
  }
};

let configured = false;
const loadedLanguages = new Set<string>();
const extensionLanguages = new Map<string, string>();

export function registerExtensionLanguage(definition: { id: string; extensions?: string[]; aliases?: string[]; monarch?: unknown; configuration?: monaco.languages.LanguageConfiguration }): monaco.IDisposable {
  const normalizedExtensions = (definition.extensions ?? []).map(extension => extension.startsWith(".") ? extension.toLowerCase() : `.${extension.toLowerCase()}`);
  monaco.languages.register({ id: definition.id, extensions: normalizedExtensions, aliases: definition.aliases });
  for (const extension of normalizedExtensions) extensionLanguages.set(extension, definition.id);
  const disposables: monaco.IDisposable[] = [];
  if (definition.monarch) disposables.push(monaco.languages.setMonarchTokensProvider(definition.id, definition.monarch as monaco.languages.IMonarchLanguage));
  if (definition.configuration) disposables.push(monaco.languages.setLanguageConfiguration(definition.id, definition.configuration));
  return { dispose: () => { for (const disposable of disposables) disposable.dispose(); for (const extension of normalizedExtensions) if (extensionLanguages.get(extension) === definition.id) extensionLanguages.delete(extension); } };
}

const LANGUAGE_LOADERS: Record<string, () => Promise<unknown>> = {
  bat: () => import("monaco-editor/languages/definitions/bat/register.js"),
  cpp: () => import("monaco-editor/languages/definitions/cpp/register.js"),
  c: () => import("monaco-editor/languages/definitions/cpp/register.js"),
  csharp: () => import("monaco-editor/languages/definitions/csharp/register.js"),
  css: () => import("monaco-editor/languages/definitions/css/register.js"),
  scss: () => import("monaco-editor/languages/definitions/scss/register.js"),
  go: () => import("monaco-editor/languages/definitions/go/register.js"),
  html: () => import("monaco-editor/languages/definitions/html/register.js"),
  ini: () => import("monaco-editor/languages/definitions/ini/register.js"),
  java: () => import("monaco-editor/languages/definitions/java/register.js"),
  javascript: () => import("monaco-editor/languages/definitions/javascript/register.js"),
  kotlin: () => import("monaco-editor/languages/definitions/kotlin/register.js"),
  lua: () => import("monaco-editor/languages/definitions/lua/register.js"),
  markdown: () => import("monaco-editor/languages/definitions/markdown/register.js"),
  php: () => import("monaco-editor/languages/definitions/php/register.js"),
  powershell: () => import("monaco-editor/languages/definitions/powershell/register.js"),
  python: () => import("monaco-editor/languages/definitions/python/register.js"),
  ruby: () => import("monaco-editor/languages/definitions/ruby/register.js"),
  rust: () => import("monaco-editor/languages/definitions/rust/register.js"),
  shell: () => import("monaco-editor/languages/definitions/shell/register.js"),
  sql: () => import("monaco-editor/languages/definitions/sql/register.js"),
  typescript: () => import("monaco-editor/languages/definitions/typescript/register.js"),
  xml: () => import("monaco-editor/languages/definitions/xml/register.js"),
  yaml: () => import("monaco-editor/languages/definitions/yaml/register.js"),
  json: () => import("monaco-editor/languages/features/json/register.js")
};

export async function ensureLanguageSupport(language: string): Promise<void> {
  const loader = LANGUAGE_LOADERS[language];
  if (!loader || loadedLanguages.has(language)) return;
  loadedLanguages.add(language);
  try {
    await loader();
  } catch (error) {
    loadedLanguages.delete(language);
    throw error;
  }
}

export function configureMonaco(): typeof monaco {
  if (configured) return monaco;
  configured = true;

  monaco.languages.register({ id: "portugol", extensions: [".por", ".gol", ".alg", ".portugol"], aliases: ["Portugol"] });
  monaco.languages.setMonarchTokensProvider("portugol", {
    defaultToken: "",
    ignoreCase: true,
    tokenPostfix: ".portugol",
    keywords: [
      "algoritmo",
      "var",
      "inicio",
      "fimalgoritmo",
      "leia",
      "limpatela",
      "escreva",
      "escreval",
      "se",
      "entao",
      "então",
      "senao",
      "senão",
      "fimse",
      "enquanto",
      "faca",
      "faça",
      "fimenquanto",
      "e",
      "ou",
      "nao",
      "não",
      "para",
      "ate",
      "até",
      "passo",
      "fimpara",
      "repita",
      "escolha",
      "caso",
      "fimescolha",
      "procedimento",
      "fimprocedimento",
      "funcao",
      "função",
      "fimfuncao",
      "fimfunção",
      "retorne",
      "vetor",
      "de"
    ],
    typeKeywords: ["inteiro", "real", "logico", "lógico", "caractere", "caracter", "literal"],
    constants: ["verdadeiro", "falso"],
    operators: ["<-", ">=", "<=", "<>", "=", ">", "<", "+", "-", "*", "/"],
    tokenizer: {
      root: [
        [/\/\/.*$/, "comment"],
        [/"([^"\\]|\\.)*$/, "string.invalid"],
        [/"/, "string", "@string"],
        [/\d+(\.\d+)?/, "number"],
        [/[a-zA-Z_\u00C0-\uFFFF][\w\u00C0-\uFFFF]*/, {
          cases: {
            "@typeKeywords": "type",
            "@keywords": "keyword",
            "@constants": "constant",
            "@default": "identifier"
          }
        }],
        [/[{}()[\],:]/, "delimiter"],
        [/[<>]=?|<-|<>|[+\-*/=]/, "operator"]
      ],
      string: [
        [/[^\\"]+/, "string"],
        [/\\./, "string.escape"],
        [/"/, "string", "@pop"]
      ]
    }
  });
  monaco.languages.setLanguageConfiguration("portugol", {
    comments: { lineComment: "//" },
    brackets: [["(", ")"], ["[", "]"]],
    autoClosingPairs: [
      { open: "(", close: ")" },
      { open: "[", close: "]" },
      { open: "\"", close: "\"" }
    ],
    surroundingPairs: [
      { open: "(", close: ")" },
      { open: "[", close: "]" },
      { open: "\"", close: "\"" }
    ]
  });
  monaco.languages.registerCompletionItemProvider("portugol", {
    provideCompletionItems(model, position) {
      const range = model.getWordUntilPosition(position);
      const replaceRange = new monaco.Range(position.lineNumber, range.startColumn, position.lineNumber, range.endColumn);
      const keywords = ["algoritmo", "var", "inicio", "fimalgoritmo", "inteiro", "real", "logico", "literal", "leia", "escreva", "escreval", "se", "entao", "senao", "fimse", "enquanto", "faca", "fimenquanto"];
      return {
        suggestions: keywords.map(keyword => ({
          label: keyword,
          kind: monaco.languages.CompletionItemKind.Keyword,
          insertText: keyword,
          range: replaceRange
        }))
      };
    }
  });

  monaco.editor.defineTheme("npsharp-dark", {
    base: "vs-dark",
    inherit: true,
    rules: [
      { token: "annotation", foreground: "dcdcaa" },
      { token: "keyword", foreground: "c586c0" },
      { token: "type", foreground: "4ec9b0" },
      { token: "number", foreground: "b5cea8" },
      { token: "string", foreground: "ce9178" },
      { token: "comment", foreground: "6a9955" },
      { token: "constant", foreground: "569cd6" },
      { token: "identifier", foreground: "d4d4d4" },
      { token: "delimiter", foreground: "d4d4d4" },
      { token: "operator", foreground: "d4d4d4" }
    ],
    colors: {
      "editor.background": "#1e1e1e",
      "editor.foreground": "#d4d4d4"
    }
  });
  monaco.editor.setTheme("npsharp-dark");

  return monaco;
}

export function languageForPath(filePath: string): string {
  const lower = filePath.toLowerCase();
  for (const [extension, language] of extensionLanguages) if (lower.endsWith(extension)) return language;
  if (lower.endsWith(".por") || lower.endsWith(".gol") || lower.endsWith(".alg") || lower.endsWith(".portugol")) return "portugol";
  if (lower.endsWith(".java")) return "java";
  if (lower.endsWith(".kt") || lower.endsWith(".kts")) return "kotlin";
  if (lower.endsWith(".ts") || lower.endsWith(".tsx")) return "typescript";
  if (lower.endsWith(".js") || lower.endsWith(".jsx") || lower.endsWith(".mjs") || lower.endsWith(".cjs")) return "javascript";
  if (lower.endsWith(".json")) return "json";
  if (lower.endsWith(".html") || lower.endsWith(".htm")) return "html";
  if (lower.endsWith(".css")) return "css";
  if (lower.endsWith(".scss")) return "scss";
  if (lower.endsWith(".xml")) return "xml";
  if (lower.endsWith(".md")) return "markdown";
  if (lower.endsWith(".py")) return "python";
  if (lower.endsWith(".sh")) return "shell";
  if (lower.endsWith(".ps1")) return "powershell";
  if (lower.endsWith(".bat") || lower.endsWith(".cmd")) return "bat";
  if (lower.endsWith(".go")) return "go";
  if (lower.endsWith(".rs")) return "rust";
  if (lower.endsWith(".php")) return "php";
  if (lower.endsWith(".rb")) return "ruby";
  if (lower.endsWith(".cs")) return "csharp";
  if (lower.endsWith(".cpp") || lower.endsWith(".cc") || lower.endsWith(".cxx") || lower.endsWith(".hpp")) return "cpp";
  if (lower.endsWith(".c") || lower.endsWith(".h")) return "c";
  if (lower.endsWith(".yaml") || lower.endsWith(".yml")) return "yaml";
  if (lower.endsWith(".toml")) return "ini";
  if (lower.endsWith(".properties") || lower.endsWith(".env")) return "ini";
  if (lower.endsWith(".sql")) return "sql";
  return "plaintext";
}

export { monaco };

export const COMPACT_MINIMAP_OPTIONS: monaco.editor.IEditorMinimapOptions = {
  enabled: true,
  size: "fit",
  scale: 1,
  maxColumn: 80,
  renderCharacters: false,
  showSlider: "mouseover",
  side: "right"
};
