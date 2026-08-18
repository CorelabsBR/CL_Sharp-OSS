export interface QuickOpenQuery {
  query: string;
  line?: number;
  column?: number;
}

/** Parses VS Code-style file queries such as `main.ts:12:4`. */
export function parseQuickOpenQuery(value: string): QuickOpenQuery {
  const input = value.trim();
  const match = /^(.*?)(?::(\d+))(?::(\d+))?$/.exec(input);
  if (!match || !match[1]) return { query: input };
  return {
    query: match[1],
    line: Math.max(1, Number(match[2])),
    column: match[3] ? Math.max(1, Number(match[3])) : undefined
  };
}
