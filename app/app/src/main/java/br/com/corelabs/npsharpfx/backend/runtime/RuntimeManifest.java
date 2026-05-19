package br.com.corelabs.npsharpfx.backend.runtime;

import java.util.HashMap;
import java.util.Map;
import java.util.Optional;

public final class RuntimeManifest {

    public record PackageDef(
            LanguageRuntime language,
            String version,
            String url,
            String archiveType,
            String executableRelativePath,
            String debuggerRelativePath
    ) {}

    private final Map<String, PackageDef> packages = new HashMap<>();

    public RuntimeManifest() {
        RuntimeTarget target = RuntimeTarget.detect();
        String key = target.key();

        add(key, new PackageDef(
                LanguageRuntime.PYTHON,
                "3.12",
                "",
                "zip",
                executable("python", target),
                "debugpy/adapter"
        ));

        add(key, new PackageDef(
                LanguageRuntime.NODE,
                "22",
                "",
                "zip",
                executable("node", target),
                "debuggers/js-debug/dapDebugServer.js"
        ));

        add(key, new PackageDef(
                LanguageRuntime.JAVA,
                "21",
                "",
                "zip",
                executable("java", target),
                "debuggers/java-debug/com.microsoft.java.debug.plugin.jar"
        ));

        add(key, new PackageDef(
                LanguageRuntime.GO,
                "1.23",
                "",
                "zip",
                executable("go", target),
                executable("dlv", target)
        ));

        add(key, new PackageDef(
                LanguageRuntime.RUST,
                "stable",
                "",
                "zip",
                executable("rustc", target),
                executable("codelldb", target)
        ));

        add(key, new PackageDef(
                LanguageRuntime.CPP,
                "llvm",
                "",
                "zip",
                executable("clang", target),
                executable("codelldb", target)
        ));

        add(key, new PackageDef(
                LanguageRuntime.CSHARP,
                "8",
                "",
                "zip",
                executable("dotnet", target),
                executable("netcoredbg", target)
        ));

        add(key, new PackageDef(
                LanguageRuntime.PHP,
                "8.3",
                "",
                "zip",
                executable("php", target),
                "debuggers/php-debug/adapter.js"
        ));

        add(key, new PackageDef(
                LanguageRuntime.RUBY,
                "3.3",
                "",
                "zip",
                executable("ruby", target),
                executable("rdbg", target)
        ));

        add(key, new PackageDef(
                LanguageRuntime.LUA,
                "5.4",
                "",
                "zip",
                executable("lua", target),
                "debuggers/lua-debug/adapter.lua"
        ));

        add(key, new PackageDef(
                LanguageRuntime.KOTLIN,
                "2.0",
                "",
                "zip",
                executable("kotlinc", target),
                "debuggers/java-debug/com.microsoft.java.debug.plugin.jar"
        ));

        add(key, new PackageDef(LanguageRuntime.DART, "stable", "", "zip", executable("dart", target), null));
        add(key, new PackageDef(LanguageRuntime.R, "stable", "", "zip", executable("Rscript", target), null));
        add(key, new PackageDef(LanguageRuntime.PERL, "stable", "", "zip", executable("perl", target), null));
        add(key, new PackageDef(LanguageRuntime.SHELL, "system", "", "zip", executable("bash", target), null));
        add(key, new PackageDef(LanguageRuntime.POWERSHELL, "system", "", "zip", executable("pwsh", target), null));
        add(key, new PackageDef(LanguageRuntime.GIT, "system", "", "zip", executable("git", target), null));

        add(key, new PackageDef(
                LanguageRuntime.PORTUGOL,
                "npsharp",
                "internal",
                "internal",
                "internal",
                "internal"
        ));
    }

    private void add(String targetKey, PackageDef def) {
        packages.put(targetKey + ":" + def.language().id(), def);
    }

    public Optional<PackageDef> find(LanguageRuntime language) {
        RuntimeTarget target = RuntimeTarget.detect();
        return Optional.ofNullable(packages.get(target.key() + ":" + language.id()));
    }

    private static String executable(String name, RuntimeTarget target) {
        if (target.os() == RuntimeTarget.Os.WINDOWS) {
            return "bin/" + name + ".exe";
        }

        return "bin/" + name;
    }
}
