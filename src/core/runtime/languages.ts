import type { LanguageRuntime } from "../../shared/types";

export const LANGUAGE_RUNTIMES: LanguageRuntime[] = [
  { id: "python", displayName: "Python", executableCandidates: ["python3", "python", "py"], extensions: [".py"] },
  { id: "node", displayName: "JavaScript/TypeScript", executableCandidates: ["node"], extensions: [".js", ".mjs", ".cjs", ".ts", ".tsx"] },
  { id: "java", displayName: "Java", executableCandidates: ["java"], extensions: [".java"] },
  { id: "cpp", displayName: "C/C++", executableCandidates: ["clang", "gcc", "g++"], extensions: [".c", ".cpp", ".cc", ".cxx", ".h", ".hpp"] },
  { id: "csharp", displayName: "C#", executableCandidates: ["dotnet"], extensions: [".cs"] },
  { id: "go", displayName: "Go", executableCandidates: ["go"], extensions: [".go"] },
  { id: "rust", displayName: "Rust", executableCandidates: ["rustc", "cargo"], extensions: [".rs"] },
  { id: "php", displayName: "PHP", executableCandidates: ["php"], extensions: [".php"] },
  { id: "ruby", displayName: "Ruby", executableCandidates: ["ruby"], extensions: [".rb"] },
  { id: "lua", displayName: "Lua", executableCandidates: ["lua", "lua5.4"], extensions: [".lua"] },
  { id: "kotlin", displayName: "Kotlin", executableCandidates: ["kotlinc", "kotlin"], extensions: [".kt", ".kts"] },
  { id: "dart", displayName: "Dart", executableCandidates: ["dart"], extensions: [".dart"] },
  { id: "r", displayName: "R", executableCandidates: ["Rscript"], extensions: [".r", ".R"] },
  { id: "perl", displayName: "Perl", executableCandidates: ["perl"], extensions: [".pl", ".pm"] },
  { id: "shell", displayName: "Shell Script", executableCandidates: ["bash", "sh"], extensions: [".sh"] },
  { id: "powershell", displayName: "PowerShell", executableCandidates: ["pwsh", "powershell"], extensions: [".ps1"] },
  { id: "git", displayName: "Git", executableCandidates: ["git"], extensions: [] },
  { id: "portugol", displayName: "Portugol", executableCandidates: ["internal-portugol"], extensions: [".gol", ".por", ".portugol", ".alg"] }
];

export function languageFromFileName(fileName: string): LanguageRuntime | undefined {
  const lower = fileName.toLowerCase();
  return LANGUAGE_RUNTIMES.find(runtime => runtime.extensions.some(ext => lower.endsWith(ext.toLowerCase())));
}
