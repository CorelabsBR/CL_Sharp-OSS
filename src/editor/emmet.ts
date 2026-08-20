/*---------------------------------------------------------------------------------------------
- Copyright (c) CorelabsBR. All rights reserved.
- Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
import expandAbbreviation, { extract } from "emmet";

export interface EmmetExpansion {
  abbreviation: string;
  snippet: string;
}

export interface EmmetLanguageConfig {
  type: "markup" | "stylesheet";
  syntax: string;
}

/** Expands an HTML abbreviation with the same Emmet 2 engine used by VS Code. */
export function expandHtmlAbbreviation(abbreviation: string): string | undefined {
  return expandEmmetAbbreviation(abbreviation, { type: "markup", syntax: "html" });
}

export function expandEmmetAbbreviation(abbreviation: string, config: EmmetLanguageConfig): string | undefined {
  const normalized = abbreviation.trim();
  if (!normalized) return undefined;
  try {
    return expandAbbreviation(normalized, {
      type: config.type,
      syntax: config.syntax,
      maxRepeat: 100,
      options: {
        "output.field": (index, placeholder) => textMateField(index, placeholder)
      }
    });
  } catch {
    return undefined;
  }
}

export function htmlAbbreviationAt(linePrefix: string): EmmetExpansion | undefined {
  return emmetAbbreviationAt(linePrefix, { type: "markup", syntax: "html" });
}

export function emmetAbbreviationAt(linePrefix: string, config: EmmetLanguageConfig): EmmetExpansion | undefined {
  const extracted = extract(linePrefix, linePrefix.length, { type: config.type, lookAhead: false });
  if (!extracted?.abbreviation) return undefined;
  const snippet = expandEmmetAbbreviation(extracted.abbreviation, config);
  return snippet ? { abbreviation: extracted.abbreviation, snippet } : undefined;
}

/** Returns the Emmet dialect applicable to a Monaco language/file pair. */
export function emmetLanguageConfig(language: string, filePath = ""): EmmetLanguageConfig | undefined {
  const normalizedPath = filePath.toLowerCase();
  if (language === "css") return { type: "stylesheet", syntax: "css" };
  if (language === "scss") return { type: "stylesheet", syntax: "scss" };
  if (language === "less") return { type: "stylesheet", syntax: "less" };
  if (language === "xml") return { type: "markup", syntax: "xml" };
  if (language === "php" || language === "handlebars" || language === "razor") return { type: "markup", syntax: "html" };
  if ((language === "javascript" && normalizedPath.endsWith(".jsx")) || (language === "typescript" && normalizedPath.endsWith(".tsx"))) {
    return { type: "markup", syntax: "jsx" };
  }
  if (language === "html") return { type: "markup", syntax: "html" };
  return undefined;
}

export function isLikelyHtmlAbbreviation(abbreviation: string): boolean {
  return abbreviation === "!" || /[.#>+^*\[\]{}]/.test(abbreviation) || COMMON_HTML_TAGS.has(abbreviation.toLowerCase());
}

const COMMON_HTML_TAGS = new Set([
  "a", "article", "aside", "body", "button", "div", "footer", "form", "h1", "h2", "h3", "h4", "h5", "h6",
  "head", "header", "html", "img", "input", "label", "li", "link", "main", "meta", "nav", "ol", "option", "p",
  "script", "section", "select", "span", "strong", "style", "table", "tbody", "td", "textarea", "th", "thead", "title", "tr", "ul"
]);

function textMateField(index: number, placeholder: string): string {
  if (index === 0) return "$0";
  if (!placeholder) return `$${index}`;
  const escaped = placeholder.replace(/([\\}$])/g, "\\$1");
  return "${" + index + ":" + escaped + "}";
}
