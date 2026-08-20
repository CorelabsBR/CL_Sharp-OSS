/*---------------------------------------------------------------------------------------------
- Copyright (c) CorelabsBR. All rights reserved.
- Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

export interface LanguageSnippet {
  name: string;
  prefix: string;
  body: string;
  description?: string;
}

interface VSCodeSnippetDefinition {
  prefix?: string | string[];
  body?: string | string[];
  description?: string;
}

const snippetSets = new Map<string, Map<symbol, LanguageSnippet[]>>();

export function registerSnippetSource(language: string, source: string | Record<string, VSCodeSnippetDefinition>): () => void {
  const parsed = typeof source === "string" ? parseSnippetSource(source) : source;
  const snippets: LanguageSnippet[] = [];
  for (const [name, definition] of Object.entries(parsed)) {
    if (!definition || typeof definition !== "object") continue;
    const prefixes = Array.isArray(definition.prefix) ? definition.prefix : [definition.prefix];
    const body = Array.isArray(definition.body) ? definition.body.join("\n") : definition.body;
    if (typeof body !== "string") continue;
    for (const prefix of prefixes) {
      if (typeof prefix === "string" && prefix.trim()) snippets.push({ name, prefix: prefix.trim(), body, description: definition.description });
    }
  }
  const key = symbolForSource();
  const sets = snippetSets.get(language) ?? new Map<symbol, LanguageSnippet[]>();
  sets.set(key, snippets);
  snippetSets.set(language, sets);
  return () => {
    sets.delete(key);
    if (!sets.size) snippetSets.delete(language);
  };
}

export function snippetsForLanguage(language: string): LanguageSnippet[] {
  return [...(snippetSets.get(language)?.values() ?? [])].flat();
}

export function snippetAtPrefix(language: string, linePrefix: string): LanguageSnippet | undefined {
  const snippets = snippetsForLanguage(language).sort((left, right) => right.prefix.length - left.prefix.length);
  return snippets.find(snippet => linePrefix.endsWith(snippet.prefix) && isPrefixBoundary(linePrefix, snippet.prefix));
}

export function matchingSnippets(language: string, typedPrefix: string): LanguageSnippet[] {
  const normalized = typedPrefix.toLocaleLowerCase();
  return snippetsForLanguage(language).filter(snippet => !normalized || snippet.prefix.toLocaleLowerCase().startsWith(normalized));
}

export function typedSnippetPrefix(linePrefix: string): string {
  return /[\w:.-]+$/.exec(linePrefix)?.[0] ?? "";
}

function isPrefixBoundary(line: string, prefix: string): boolean {
  const previous = line[line.length - prefix.length - 1];
  return !previous || !/[\w$]/.test(previous);
}

function symbolForSource(): symbol {
  return Symbol("snippet-source");
}

function stripJsonComments(source: string): string {
  return source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
}

function parseSnippetSource(source: string): Record<string, VSCodeSnippetDefinition> {
  try {
    return JSON.parse(source) as Record<string, VSCodeSnippetDefinition>;
  } catch {
    return JSON.parse(stripJsonComments(source)) as Record<string, VSCodeSnippetDefinition>;
  }
}
