/*---------------------------------------------------------------------------------------------
- Copyright (c) CorelabsBR. All rights reserved.
- Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
import expandAbbreviation, { extract } from "emmet";

export interface EmmetExpansion {
  abbreviation: string;
  snippet: string;
}

/** Expands an HTML abbreviation with the same Emmet 2 engine used by VS Code. */
export function expandHtmlAbbreviation(abbreviation: string): string | undefined {
  const normalized = abbreviation.trim();
  if (!normalized) return undefined;
  try {
    return expandAbbreviation(normalized, {
      type: "markup",
      syntax: "html",
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
  const extracted = extract(linePrefix, linePrefix.length, { type: "markup", lookAhead: false });
  if (!extracted?.abbreviation) return undefined;
  const snippet = expandHtmlAbbreviation(extracted.abbreviation);
  return snippet ? { abbreviation: extracted.abbreviation, snippet } : undefined;
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
