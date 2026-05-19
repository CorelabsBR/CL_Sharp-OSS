package br.com.corelabs.npsharpfx.backend.runtime;

public enum LanguageRuntime {
    PYTHON("python", "Python", ".py"),
    NODE("node", "JavaScript/TypeScript", ".js", ".ts"),
    JAVA("java", "Java", ".java"),
    CPP("cpp", "C/C++", ".c", ".cpp", ".cc", ".h", ".hpp"),
    CSHARP("csharp", "C#", ".cs"),
    GO("go", "Go", ".go"),
    RUST("rust", "Rust", ".rs"),
    PHP("php", "PHP", ".php"),
    RUBY("ruby", "Ruby", ".rb"),
    LUA("lua", "Lua", ".lua"),
    KOTLIN("kotlin", "Kotlin", ".kt"),
    PORTUGOL("portugol", "Portugol", ".gol", ".alg");

    private final String id;
    private final String displayName;
    private final String[] extensions;

    LanguageRuntime(String id, String displayName, String... extensions) {
        this.id = id;
        this.displayName = displayName;
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