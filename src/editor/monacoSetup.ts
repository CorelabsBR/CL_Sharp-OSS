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
import "monaco-editor/features/snippet/register.js";
import "monaco-editor/features/suggest/register.js";
import { emmetAbbreviationAt, emmetLanguageConfig, htmlAbbreviationAt, isLikelyHtmlAbbreviation } from "./emmet";
import { matchingSnippets, registerSnippetSource, typedSnippetPrefix } from "./snippets";
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
const snippetCompletionLanguages = new Set<string>();
const bundledSnippetSources = import.meta.glob("../../resources/snippets/*.json", { eager: true, query: "?raw", import: "default" }) as Record<string, string>;

export function registerLanguageSnippets(language: string, source: string): () => void {
  const disposeSource = registerSnippetSource(language, source);
  registerSnippetCompletionProvider(language);
  return disposeSource;
}

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
  css: () => Promise.all([import("monaco-editor/languages/definitions/css/register.js"), import("monaco-editor/language/css/monaco.contribution.js")]),
  scss: () => Promise.all([import("monaco-editor/languages/definitions/scss/register.js"), import("monaco-editor/language/css/monaco.contribution.js")]),
  less: () => Promise.all([import("monaco-editor/languages/definitions/less/register.js"), import("monaco-editor/language/css/monaco.contribution.js")]),
  go: () => import("monaco-editor/languages/definitions/go/register.js"),
  html: () => Promise.all([import("monaco-editor/languages/definitions/html/register.js"), import("monaco-editor/language/html/monaco.contribution.js")]),
  ini: () => import("monaco-editor/languages/definitions/ini/register.js"),
  java: () => import("monaco-editor/languages/definitions/java/register.js"),
  javascript: () => Promise.all([import("monaco-editor/languages/definitions/javascript/register.js"), import("monaco-editor/language/typescript/monaco.contribution.js")]),
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
  typescript: () => Promise.all([import("monaco-editor/languages/definitions/typescript/register.js"), import("monaco-editor/language/typescript/monaco.contribution.js")]),
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

  const emmetCompletionProvider: monaco.languages.CompletionItemProvider = {
    triggerCharacters: ["!", ".", "#", ">", "+", "*", ":", "-", "@"],
    provideCompletionItems(model, position) {
      const prefix = model.getLineContent(position.lineNumber).slice(0, position.column - 1);
      const config = emmetLanguageConfig(model.getLanguageId(), model.uri.path);
      const expansion = config ? emmetAbbreviationAt(prefix, config) : htmlAbbreviationAt(prefix);
      if (!expansion) return { suggestions: [] };
      if (model.getLanguageId() === "plaintext" && (!isLikelyHtmlAbbreviation(expansion.abbreviation) || model.getValue().trim() !== expansion.abbreviation)) return { suggestions: [] };
      return {
        suggestions: [{
          label: expansion.abbreviation,
          detail: "Emmet Abbreviation",
          documentation: { value: `**Emmet**\n\n\`\`\`${config?.syntax ?? "html"}\n${expansion.snippet.replace(/\$\{?\d+(?::([^}]*))?\}?/g, "$1")}\n\`\`\`` },
          kind: monaco.languages.CompletionItemKind.Snippet,
          insertText: expansion.snippet,
          insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
          range: new monaco.Range(position.lineNumber, position.column - expansion.abbreviation.length, position.lineNumber, position.column),
          sortText: "0000"
        }]
      };
    }
  };
  monaco.languages.registerCompletionItemProvider("html", emmetCompletionProvider);
  monaco.languages.registerCompletionItemProvider("plaintext", emmetCompletionProvider);
  for (const language of ["css", "scss", "less", "xml", "php", "handlebars", "razor", "javascript", "typescript"]) {
    monaco.languages.registerCompletionItemProvider(language, emmetCompletionProvider);
  }

  registerLanguageKeywordCompletions();
  for (const [path, source] of Object.entries(bundledSnippetSources)) {
    const language = path.split("/").pop()?.replace(/\.json$/i, "");
    if (language) registerLanguageSnippets(language, source);
  }

  monaco.editor.defineTheme("sharp-dark", {
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
  monaco.editor.setTheme("sharp-dark");

  return monaco;
}

const LANGUAGE_KEYWORDS: Record<string, string[]> = {
  python: ["and", "as", "assert", "async", "await", "break", "case", "class", "continue", "def", "del", "elif", "else", "except", "False", "finally", "for", "from", "global", "if", "import", "in", "is", "lambda", "match", "None", "nonlocal", "not", "or", "pass", "raise", "return", "True", "try", "while", "with", "yield", "print", "len", "range", "str", "int", "list", "dict", "set", "tuple"],
  java: ["abstract", "assert", "boolean", "break", "byte", "case", "catch", "char", "class", "const", "continue", "default", "do", "double", "else", "enum", "extends", "final", "finally", "float", "for", "if", "implements", "import", "instanceof", "int", "interface", "long", "native", "new", "package", "private", "protected", "public", "record", "return", "short", "static", "strictfp", "super", "switch", "synchronized", "this", "throw", "throws", "transient", "try", "var", "void", "volatile", "while"],
  kotlin: ["as", "break", "class", "continue", "do", "else", "false", "for", "fun", "if", "in", "interface", "is", "null", "object", "package", "return", "super", "this", "throw", "true", "try", "typealias", "typeof", "val", "var", "when", "while"],
  c: ["auto", "break", "case", "char", "const", "continue", "default", "do", "double", "else", "enum", "extern", "float", "for", "goto", "if", "inline", "int", "long", "register", "restrict", "return", "short", "signed", "sizeof", "static", "struct", "switch", "typedef", "union", "unsigned", "void", "volatile", "while"],
  cpp: ["alignas", "auto", "bool", "break", "case", "catch", "char", "class", "concept", "const", "constexpr", "continue", "default", "delete", "do", "double", "else", "enum", "explicit", "export", "extern", "false", "float", "for", "friend", "if", "inline", "int", "long", "namespace", "new", "nullptr", "private", "protected", "public", "return", "short", "signed", "sizeof", "static", "struct", "switch", "template", "this", "throw", "true", "try", "typedef", "typename", "union", "unsigned", "using", "virtual", "void", "volatile", "while"],
  csharp: ["abstract", "as", "async", "await", "base", "bool", "break", "case", "catch", "class", "const", "continue", "decimal", "default", "delegate", "do", "double", "else", "enum", "event", "explicit", "extern", "false", "finally", "fixed", "float", "for", "foreach", "if", "implicit", "in", "int", "interface", "internal", "is", "lock", "long", "namespace", "new", "null", "object", "operator", "out", "override", "params", "private", "protected", "public", "readonly", "record", "ref", "return", "sealed", "short", "sizeof", "static", "string", "struct", "switch", "this", "throw", "true", "try", "typeof", "uint", "ulong", "unchecked", "unsafe", "ushort", "using", "var", "virtual", "void", "volatile", "while"],
  go: ["break", "case", "chan", "const", "continue", "default", "defer", "else", "fallthrough", "for", "func", "go", "goto", "if", "import", "interface", "map", "package", "range", "return", "select", "struct", "switch", "type", "var"],
  rust: ["as", "async", "await", "break", "const", "continue", "crate", "dyn", "else", "enum", "extern", "false", "fn", "for", "if", "impl", "in", "let", "loop", "match", "mod", "move", "mut", "pub", "ref", "return", "self", "Self", "static", "struct", "super", "trait", "true", "type", "unsafe", "use", "where", "while"],
  php: ["abstract", "and", "array", "as", "break", "callable", "case", "catch", "class", "clone", "const", "continue", "declare", "default", "do", "echo", "else", "elseif", "empty", "endfor", "endforeach", "endif", "endswitch", "endwhile", "enum", "extends", "final", "finally", "fn", "for", "foreach", "function", "global", "if", "implements", "include", "include_once", "instanceof", "interface", "isset", "match", "namespace", "new", "null", "or", "private", "protected", "public", "readonly", "require", "require_once", "return", "static", "switch", "throw", "trait", "true", "try", "use", "var", "while", "yield"],
  ruby: ["alias", "and", "begin", "break", "case", "class", "def", "defined?", "do", "else", "elsif", "end", "ensure", "false", "for", "if", "in", "module", "next", "nil", "not", "or", "redo", "rescue", "retry", "return", "self", "super", "then", "true", "undef", "unless", "until", "when", "while", "yield"],
  shell: ["case", "do", "done", "elif", "else", "esac", "export", "fi", "for", "function", "if", "in", "local", "readonly", "return", "select", "then", "until", "while"],
  sql: ["ALTER", "AND", "AS", "ASC", "BEGIN", "BETWEEN", "BY", "CASE", "COMMIT", "CREATE", "DATABASE", "DELETE", "DESC", "DISTINCT", "DROP", "ELSE", "END", "EXISTS", "FROM", "FULL", "GROUP", "HAVING", "IN", "INDEX", "INNER", "INSERT", "INTO", "IS", "JOIN", "LEFT", "LIKE", "LIMIT", "NOT", "NULL", "ON", "OR", "ORDER", "OUTER", "PRIMARY", "REFERENCES", "RIGHT", "ROLLBACK", "SELECT", "SET", "TABLE", "THEN", "UNION", "UNIQUE", "UPDATE", "VALUES", "VIEW", "WHEN", "WHERE", "WITH"]
};

function registerLanguageKeywordCompletions(): void {
  for (const [language, keywords] of Object.entries(LANGUAGE_KEYWORDS)) {
    monaco.languages.registerCompletionItemProvider(language, {
      provideCompletionItems(model, position) {
        const word = model.getWordUntilPosition(position);
        const range = new monaco.Range(position.lineNumber, word.startColumn, position.lineNumber, word.endColumn);
        return {
          suggestions: keywords.map(keyword => ({
            label: keyword,
            kind: monaco.languages.CompletionItemKind.Keyword,
            insertText: keyword,
            range
          }))
        };
      }
    });
  }
}

function registerSnippetCompletionProvider(language: string): void {
  if (snippetCompletionLanguages.has(language)) return;
  snippetCompletionLanguages.add(language);
  monaco.languages.registerCompletionItemProvider(language, {
    provideCompletionItems(model, position) {
      const linePrefix = model.getLineContent(position.lineNumber).slice(0, position.column - 1);
      const typedPrefix = typedSnippetPrefix(linePrefix);
      const range = new monaco.Range(position.lineNumber, position.column - typedPrefix.length, position.lineNumber, position.column);
      return {
        suggestions: matchingSnippets(language, typedPrefix).map((snippet, index) => ({
          label: snippet.prefix,
          detail: snippet.name,
          documentation: snippet.description,
          kind: monaco.languages.CompletionItemKind.Snippet,
          insertText: snippet.body,
          insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
          filterText: snippet.prefix,
          range,
          sortText: `0000-${snippet.prefix}`,
          preselect: index === 0
        })),
        incomplete: true
      };
    }
  });
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
  if (lower.endsWith(".less")) return "less";
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
