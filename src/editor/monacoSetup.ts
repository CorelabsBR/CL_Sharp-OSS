import * as monaco from "monaco-editor/esm/vs/editor/editor.api";
// The minimal editor API does not include Codicon styles. The Find widget uses
// those glyphs for its controls (next/previous, replace and close).
import "monaco-editor/esm/vs/base/browser/ui/codicons/codiconStyles.js";
// editor.api does not register the Find contribution; import it explicitly so
// Ctrl+F/Cmd+F and the title-bar command share Monaco's real Find widget.
import "monaco-editor/esm/vs/editor/contrib/find/browser/findController.js";
import "monaco-editor/esm/vs/basic-languages/bat/bat.contribution.js";
import "monaco-editor/esm/vs/basic-languages/cpp/cpp.contribution.js";
import "monaco-editor/esm/vs/basic-languages/csharp/csharp.contribution.js";
import "monaco-editor/esm/vs/basic-languages/css/css.contribution.js";
import "monaco-editor/esm/vs/basic-languages/go/go.contribution.js";
import "monaco-editor/esm/vs/basic-languages/html/html.contribution.js";
import "monaco-editor/esm/vs/basic-languages/ini/ini.contribution.js";
import "monaco-editor/esm/vs/basic-languages/java/java.contribution.js";
import "monaco-editor/esm/vs/basic-languages/javascript/javascript.contribution.js";
import "monaco-editor/esm/vs/basic-languages/kotlin/kotlin.contribution.js";
import "monaco-editor/esm/vs/basic-languages/lua/lua.contribution.js";
import "monaco-editor/esm/vs/basic-languages/markdown/markdown.contribution.js";
import "monaco-editor/esm/vs/basic-languages/php/php.contribution.js";
import "monaco-editor/esm/vs/basic-languages/powershell/powershell.contribution.js";
import "monaco-editor/esm/vs/basic-languages/python/python.contribution.js";
import "monaco-editor/esm/vs/basic-languages/ruby/ruby.contribution.js";
import "monaco-editor/esm/vs/basic-languages/rust/rust.contribution.js";
import "monaco-editor/esm/vs/basic-languages/scss/scss.contribution.js";
import "monaco-editor/esm/vs/basic-languages/shell/shell.contribution.js";
import "monaco-editor/esm/vs/basic-languages/sql/sql.contribution.js";
import "monaco-editor/esm/vs/basic-languages/typescript/typescript.contribution.js";
import "monaco-editor/esm/vs/basic-languages/xml/xml.contribution.js";
import "monaco-editor/esm/vs/basic-languages/yaml/yaml.contribution.js";
import "monaco-editor/esm/vs/language/json/monaco.contribution.js";
import editorWorker from "monaco-editor/esm/vs/editor/editor.worker?worker";
import jsonWorker from "monaco-editor/esm/vs/language/json/json.worker?worker";
import cssWorker from "monaco-editor/esm/vs/language/css/css.worker?worker";
import htmlWorker from "monaco-editor/esm/vs/language/html/html.worker?worker";
import tsWorker from "monaco-editor/esm/vs/language/typescript/ts.worker?worker";

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
