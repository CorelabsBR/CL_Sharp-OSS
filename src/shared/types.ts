export interface AppInfo {
  name: string;
  version: string;
  platform: NodeJS.Platform | string;
  userDataPath: string;
  appPath: string;
  npsharpHome: string;
}

export interface DialogFileResult {
  canceled: boolean;
  paths: string[];
}

export interface WorkspaceEntry {
  path: string;
  name: string;
  directory: boolean;
  size: number;
  modifiedAt: number;
  hidden: boolean;
}

export interface FileReadResult {
  path: string;
  name: string;
  content: string;
  lineEnding: "\n" | "\r\n";
  encoding: "utf8";
}

export interface SaveFileRequest {
  path?: string;
  suggestedName?: string;
  content: string;
}

export interface SaveFileResult {
  canceled: boolean;
  path?: string;
}

export interface AppSettings {
  theme: string;
  iconTheme: string;
  iconColor: string;
  wallpaperPath: string;
  wallpaperOpacity: number;
  editorFontFamily: string;
  editorFontSize: number;
  editorTabSize: number;
  editorWordWrap: boolean;
  editorLineNumbers: boolean;
  editorAutoSave: boolean;
  editorFormatOnSave: boolean;
  brandSpecialName: string;
  terminalEnabled: boolean;
  terminalShellLinux: string;
  terminalShellWindows: string;
  terminalInitialDirectory: string;
  diagnosticsEnabled: boolean;
  errorLensEnabled: boolean;
  compileOnSave: boolean;
  problemsAutoOpen: boolean;
  buildCommand: string;
  buildSkipTests: boolean;
  statusBarVisible: boolean;
  activityBarVisible: boolean;
  sideBarVisible: boolean;
}

export interface PersistedSession {
  workspace?: string;
  recentWorkspaces?: string[];
  openFiles: string[];
  activeFile?: string;
  sidePanel: string;
  terminalVisible: boolean;
}

export interface SearchQuery {
  workspace: string;
  text: string;
  caseSensitive: boolean;
  wholeWord: boolean;
  useRegex?: boolean;
  includeHidden?: boolean;
  limit?: number;
}

export interface SearchResult {
  filePath: string;
  relativePath: string;
  line: number;
  column: number;
  start: number;
  end: number;
  preview: string;
  score: number;
}

export interface ReplaceAllRequest extends SearchQuery {
  replaceWith: string;
}

export interface ReplaceAllResult {
  changedFiles: number;
  replacements: number;
}

export type DiagnosticSeverity = "ERROR" | "WARNING" | "INFORMATION" | "HINT";

export interface EditorDiagnostic {
  filePath: string;
  line: number;
  column: number;
  endLine?: number;
  endColumn?: number;
  message: string;
  severity: DiagnosticSeverity;
  source: string;
}

export type GitStatusKind =
  | "added"
  | "modified"
  | "deleted"
  | "renamed"
  | "untracked"
  | "ignored"
  | "conflicted";

export interface GitFileStatus {
  repositoryName: string;
  repo: string;
  path: string;
  absolutePath: string;
  oldPath: string;
  kind: GitStatusKind;
  staged: boolean;
  conflicted: boolean;
  ignored: boolean;
  x: string;
  y: string;
}

export interface GitRepositoryStatus {
  repo: string;
  name: string;
  branch: string;
  ahead: number;
  behind: number;
  files: GitFileStatus[];
  branches: string[];
  clean: boolean;
}

export interface GitCommit {
  hash: string;
  author: string;
  date: string;
  subject: string;
  body: string;
}

export interface GitOperationResult {
  success: boolean;
  output: string;
}

export interface TerminalRunRequest {
  cwd: string;
  command: string;
  shell?: string;
}

export interface TerminalRunResult {
  cwd: string;
  output: string;
  code: number | null;
}

export interface LanguageRuntime {
  id: string;
  displayName: string;
  executableCandidates: string[];
  extensions: string[];
}

export interface InstalledRuntime {
  language: LanguageRuntime;
  rootPath: string;
  executablePath: string;
  debuggerPath?: string;
  version: string;
  source: "system" | "configured" | "internal";
}

export interface RuntimeRunRequest {
  filePath: string;
  content?: string;
}

export interface RuntimeRunResult {
  language?: string;
  output: string;
  code: number;
}

export interface LiveServerRequest {
  workspace: string;
  filePath: string;
}

export interface LiveServerResult {
  success: boolean;
  output: string;
  url?: string;
}

export interface TemplateApplyRequest {
  template: "class" | "enum" | "interface" | "record";
  packageName: string;
  name: string;
}

export interface RemoteHostConfig {
  name: string;
  host: string;
  port: number;
  username: string;
  authMethod: "agent" | "key" | "password";
  privateKeyPath: string;
  defaultPath: string;
}

export interface RemoteCommandRequest {
  config: RemoteHostConfig;
  password?: string;
  command: string;
}

export interface RemoteListRequest {
  config: RemoteHostConfig;
  password?: string;
  path: string;
}

export interface RemoteFileRequest {
  config: RemoteHostConfig;
  password?: string;
  path: string;
  content?: string;
}

export interface WindowControlsApi {
  minimize(): Promise<void>;
  maximize(): Promise<void>;
  close(): Promise<void>;
  isMaximized(): Promise<boolean>;
}

export interface NpsharpApi {
  appInfo(): Promise<AppInfo>;
  window: WindowControlsApi;
  dialog: {
    openFile(): Promise<DialogFileResult>;
    openFolder(): Promise<DialogFileResult>;
    saveFile(request: SaveFileRequest): Promise<SaveFileResult>;
    chooseWallpaper(): Promise<DialogFileResult>;
  };
  settings: {
    load(): Promise<AppSettings>;
    save(settings: AppSettings): Promise<AppSettings>;
    reset(): Promise<AppSettings>;
    loadSession(): Promise<PersistedSession>;
    saveSession(session: PersistedSession): Promise<void>;
  };
  fs: {
    listDir(path: string): Promise<WorkspaceEntry[]>;
    readFile(path: string): Promise<FileReadResult>;
    writeFile(path: string, content: string): Promise<void>;
    createFile(path: string): Promise<void>;
    createFolder(path: string): Promise<void>;
    rename(oldPath: string, newPath: string): Promise<void>;
    delete(path: string): Promise<void>;
    reveal(path: string): Promise<void>;
    exists(path: string): Promise<boolean>;
  };
  search: {
    workspace(query: SearchQuery): Promise<SearchResult[]>;
    replaceAll(request: ReplaceAllRequest): Promise<ReplaceAllResult>;
  };
  diagnostics: {
    java(workspace: string, filePath?: string): Promise<EditorDiagnostic[]>;
  };
  git: {
    status(workspace: string): Promise<GitRepositoryStatus[]>;
    run(repo: string, args: string[]): Promise<GitOperationResult>;
    stage(repo: string, file: GitFileStatus): Promise<GitOperationResult>;
    unstage(repo: string, file: GitFileStatus): Promise<GitOperationResult>;
    discard(repo: string, file: GitFileStatus): Promise<GitOperationResult>;
    commit(repo: string, message: string, allowEmpty?: boolean): Promise<GitOperationResult>;
    checkout(repo: string, branch: string): Promise<GitOperationResult>;
    createBranch(repo: string, branch: string): Promise<GitOperationResult>;
    diff(repo: string, file: GitFileStatus, staged: boolean): Promise<string>;
    history(repo: string): Promise<GitCommit[]>;
  };
  terminal: {
    run(request: TerminalRunRequest): Promise<TerminalRunResult>;
  };
  runtime: {
    list(): Promise<InstalledRuntime[]>;
    discover(): Promise<InstalledRuntime[]>;
    configure(languageId: string, executablePath: string): Promise<InstalledRuntime[]>;
    runFile(request: RuntimeRunRequest): Promise<RuntimeRunResult>;
  };
  liveServer: {
    open(request: LiveServerRequest): Promise<LiveServerResult>;
    stopAll(): Promise<GitOperationResult>;
  };
  templates: {
    apply(request: TemplateApplyRequest): Promise<string>;
  };
  remote: {
    loadHosts(): Promise<RemoteHostConfig[]>;
    saveHosts(hosts: RemoteHostConfig[]): Promise<void>;
    test(request: RemoteCommandRequest): Promise<GitOperationResult>;
    list(request: RemoteListRequest): Promise<WorkspaceEntry[]>;
    readFile(request: RemoteFileRequest): Promise<FileReadResult>;
    writeFile(request: RemoteFileRequest): Promise<void>;
    mkdir(request: RemoteFileRequest): Promise<void>;
    touch(request: RemoteFileRequest): Promise<void>;
    rename(request: RemoteFileRequest & { newPath: string }): Promise<void>;
    delete(request: RemoteFileRequest): Promise<void>;
    execute(request: RemoteCommandRequest): Promise<GitOperationResult>;
  };
}

declare global {
  interface Window {
    npsharp?: NpsharpApi;
    npsharpApi?: NpsharpApi;
  }
}
