export interface RegisteredCommand {
  id: string;
  category: string;
  title: string;
  shortcut?: string;
  keywords?: string;
  when?: () => boolean;
  execute: () => void | Promise<void>;
}

/** Central registry shared by menus, shortcuts and extension contributions. */
export class CommandRegistry {
  private readonly commands = new Map<string, RegisteredCommand>();

  register(command: RegisteredCommand): () => void {
    if (!command.id.trim()) throw new Error("Command id must not be empty");
    this.commands.set(command.id, command);
    return () => {
      if (this.commands.get(command.id) === command) this.commands.delete(command.id);
    };
  }

  get(id: string): RegisteredCommand | undefined {
    return this.commands.get(id);
  }

  list(onlyAvailable = true): RegisteredCommand[] {
    return [...this.commands.values()].filter(command => !onlyAvailable || !command.when || command.when());
  }

  async execute(id: string): Promise<boolean> {
    const command = this.commands.get(id);
    if (!command || (command.when && !command.when())) return false;
    await command.execute();
    return true;
  }
}

/** Scores ordered character matches while strongly preferring contiguous matches. */
export function fuzzyScore(query: string, candidate: string): number {
  if (!query) return 0;
  const exact = candidate.indexOf(query);
  if (exact >= 0) return 10_000 - exact;
  let score = 0;
  let queryIndex = 0;
  let previousMatch = -2;
  for (let index = 0; index < candidate.length && queryIndex < query.length; index++) {
    if (candidate[index] !== query[queryIndex]) continue;
    score += 10;
    if (index === previousMatch + 1) score += 15;
    if (index === 0 || /[\s/\\_.:-]/.test(candidate[index - 1])) score += 8;
    score -= Math.min(index, 20);
    previousMatch = index;
    queryIndex++;
  }
  return queryIndex === query.length ? score : -1;
}
