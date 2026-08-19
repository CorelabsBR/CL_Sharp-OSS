/*---------------------------------------------------------------------------------------------
- Copyright (c) CorelabsBR. All rights reserved.
- Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

export interface EmmetExpansion {
  abbreviation: string;
  snippet: string;
}

const HTML_SNIPPETS: Record<string, string> = {
  "!": "<!DOCTYPE html>\n<html lang=\"${1:en}\">\n<head>\n\t<meta charset=\"UTF-8\">\n\t<meta name=\"viewport\" content=\"width=device-width, initial-scale=1.0\">\n\t<title>${2:Document}</title>\n</head>\n<body>\n\t$0\n</body>\n</html>",
  "html:5": "<!DOCTYPE html>\n<html lang=\"${1:en}\">\n<head>\n\t<meta charset=\"UTF-8\">\n\t<meta name=\"viewport\" content=\"width=device-width, initial-scale=1.0\">\n\t<title>${2:Document}</title>\n</head>\n<body>\n\t$0\n</body>\n</html>",
  "link:css": "<link rel=\"stylesheet\" href=\"${1:style.css}\">$0",
  "script:src": "<script src=\"${1:index.js}\"></script>$0",
  "meta:vp": "<meta name=\"viewport\" content=\"width=device-width, initial-scale=1.0\">$0",
  "input:text": "<input type=\"text\" name=\"${1}\" id=\"${2}\">$0",
  "input:email": "<input type=\"email\" name=\"${1}\" id=\"${2}\">$0",
  "input:password": "<input type=\"password\" name=\"${1}\" id=\"${2}\">$0",
  "btn": "<button type=\"button\">${1:Button}</button>$0",
  "a": "<a href=\"${1}\">${2}</a>$0",
  "img": "<img src=\"${1}\" alt=\"${2}\">$0"
};

const VOID_ELEMENTS = new Set(["area", "base", "br", "col", "embed", "hr", "img", "input", "link", "meta", "param", "source", "track", "wbr"]);

/** Expands the practical HTML Emmet subset used during everyday editing. */
export function expandHtmlAbbreviation(abbreviation: string): string | undefined {
  const normalized = abbreviation.trim();
  if (!normalized) return undefined;
  if (HTML_SNIPPETS[normalized]) return HTML_SNIPPETS[normalized];

  const chain = normalized.split(">");
  if (chain.some(part => !part || part.includes("+"))) return undefined;
  let child = "$0";
  for (let index = chain.length - 1; index >= 0; index -= 1) {
    const match = /^([a-z][\w-]*)?((?:[.#][\w-]+)*)(?:\*(\d+))?$/i.exec(chain[index]);
    if (!match) return undefined;
    const tag = match[1] || "div";
    const attributes = attributesFor(match[2]);
    const count = Math.min(Number(match[3] || 1), 100);
    const items: string[] = [];
    for (let item = 1; item <= count; item += 1) {
      const numberedAttributes = attributes.replaceAll("$", String(item));
      if (VOID_ELEMENTS.has(tag.toLowerCase())) items.push(`<${tag}${numberedAttributes}>`);
      else items.push(`<${tag}${numberedAttributes}>${child}</${tag}>`);
    }
    child = items.join("\n");
  }
  return child;
}

export function htmlAbbreviationAt(linePrefix: string): EmmetExpansion | undefined {
  const match = /(?:^|\s)(!?[a-z.#][\w:>.*#-]*|!)$/i.exec(linePrefix);
  if (!match) return undefined;
  const abbreviation = match[1];
  const snippet = expandHtmlAbbreviation(abbreviation);
  return snippet ? { abbreviation, snippet } : undefined;
}

function attributesFor(shorthand: string): string {
  const attributes: string[] = [];
  const classes: string[] = [];
  for (const match of shorthand.matchAll(/([.#])([\w-]+)/g)) {
    if (match[1] === "#") attributes.push(`id=\"${match[2]}\"`);
    else classes.push(match[2]);
  }
  if (classes.length) attributes.push(`class=\"${classes.join(" ")}\"`);
  return attributes.length ? ` ${attributes.join(" ")}` : "";
}
