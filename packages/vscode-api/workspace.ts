export interface WorkspaceFolder {
  readonly uri: string;
  readonly name: string;
  readonly index: number;
}

export interface WorkspaceConfiguration {
  get<T>(section: string, defaultValue?: T): T | undefined;
  update(section: string, value: unknown): Promise<void>;
}

const configuration = new Map<string, unknown>();

export const workspaceFolders: readonly WorkspaceFolder[] = [];

export function getConfiguration(section = ""): WorkspaceConfiguration {
  const prefix = section ? `${section}.` : "";
  return {
    get<T>(key: string, defaultValue?: T): T | undefined {
      return configuration.has(`${prefix}${key}`) ? configuration.get(`${prefix}${key}`) as T : defaultValue;
    },
    async update(key: string, value: unknown): Promise<void> {
      configuration.set(`${prefix}${key}`, value);
    }
  };
}
