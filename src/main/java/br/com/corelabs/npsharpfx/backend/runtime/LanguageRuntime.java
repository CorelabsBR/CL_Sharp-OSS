/**
 * Copyright (c) CoreLabs. Todos os direitos reservados.
 * Licenciado sob os termos da licença Proprietária CoreLabs.
 * Consulte o arquivo LICENSE na raiz do projeto para mais informações.
 */
package br.com.corelabs.npsharpfx.backend.runtime;

public enum LanguageRuntime {
    PYTHON("python", "Python", new String[] { "python", "python3", "py" }, ".py"),
    NODE("node", "JavaScript/TypeScript", new String[] { "node" }, ".js", ".mjs", ".cjs", ".ts", ".tsx"),
    JAVA("java", "Java", new String[] { "java" }, ".java"),
    CPP("cpp", "C/C++", new String[] { "clang", "gcc", "g++" }, ".c", ".cpp", ".cc", ".cxx", ".h", ".hpp"),
    CSHARP("csharp", "C#", new String[] { "dotnet" }, ".cs"),
    GO("go", "Go", new String[] { "go" }, ".go"),
    RUST("rust", "Rust", new String[] { "rustc", "cargo" }, ".rs"),
    PHP("php", "PHP", new String[] { "php" }, ".php"),
    RUBY("ruby", "Ruby", new String[] { "ruby" }, ".rb"),
    LUA("lua", "Lua", new String[] { "lua", "lua5.4" }, ".lua"),
    KOTLIN("kotlin", "Kotlin", new String[] { "kotlinc", "kotlin" }, ".kt", ".kts"),
    DART("dart", "Dart", new String[] { "dart" }, ".dart"),
    R("r", "R", new String[] { "Rscript" }, ".r", ".R"),
    PERL("perl", "Perl", new String[] { "perl" }, ".pl", ".pm"),
    SHELL("shell", "Shell Script", new String[] { "bash", "sh" }, ".sh"),
    POWERSHELL("powershell", "PowerShell", new String[] { "pwsh", "powershell" }, ".ps1"),
    GIT("git", "Git", new String[] { "git" }),
    PORTUGOL("portugol", "Portugol", new String[] { "internal-portugol" }, ".gol", ".por", ".portugol", ".alg");

    private final String id;
    private final String displayName;
    private final String[] executableCandidates;
    private final String[] extensions;

    LanguageRuntime(String id, String displayName, String[] executableCandidates, String... extensions) {
        this.id = id;
        this.displayName = displayName;
        this.executableCandidates = executableCandidates;
        this.extensions = extensions;
    }

    public String id() {
        return id;
    }

    public String displayName() {
        return displayName;
    }

    public String[] extensions() {
        return extensions;
    }

    public String[] executableCandidates() {
        return executableCandidates;
    }

    public static LanguageRuntime fromFileName(String fileName) {
        String lower = fileName.toLowerCase();

        for (LanguageRuntime runtime : values()) {
            for (String ext : runtime.extensions) {
                if (lower.endsWith(ext)) {
                    return runtime;
                }
            }
        }

        return null;
    }
}
