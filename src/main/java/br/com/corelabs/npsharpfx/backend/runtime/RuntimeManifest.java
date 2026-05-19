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
                "Colocar_a_merda_do_link_aqui_gordao/python-" + key + ".zip",
                "zip",
                executable("python", target),
                "debugpy/adapter"
        ));

        add(key, new PackageDef(
                LanguageRuntime.NODE,
                "22",
                "Colocar_a_merda_do_link_aqui_gordao/node-" + key + ".zip",
                "zip",
                executable("node", target),
                "debuggers/js-debug/dapDebugServer.js"
        ));

        add(key, new PackageDef(
                LanguageRuntime.JAVA,
                "21",
                "Colocar_a_merda_do_link_aqui_gordao/jdk-" + key + ".zip",
                "zip",
                executable("java", target),
                "debuggers/java-debug/com.microsoft.java.debug.plugin.jar"
        ));

        add(key, new PackageDef(
                LanguageRuntime.GO,
                "1.23",
                "Colocar_a_merda_do_link_aqui_gordao/go-" + key + ".zip",
                "zip",
                executable("go", target),
                executable("dlv", target)
        ));

        add(key, new PackageDef(
                LanguageRuntime.RUST,
                "stable",
                "Colocar_a_merda_do_link_aqui_gordao/rust-" + key + ".zip",
                "zip",
                executable("rustc", target),
                executable("codelldb", target)
        ));

        add(key, new PackageDef(
                LanguageRuntime.CPP,
                "llvm",
                "Colocar_a_merda_do_link_aqui_gordao/llvm-" + key + ".zip",
                "zip",
                executable("clang", target),
                executable("codelldb", target)
        ));

        add(key, new PackageDef(
                LanguageRuntime.CSHARP,
                "8",
                "Colocar_a_merda_do_link_aqui_gordao/dotnet-" + key + ".zip",
                "zip",
                executable("dotnet", target),
                executable("netcoredbg", target)
        ));

        add(key, new PackageDef(
                LanguageRuntime.PHP,
                "8.3",
                "Colocar_a_merda_do_link_aqui_gordao/php-" + key + ".zip",
                "zip",
                executable("php", target),
                "debuggers/php-debug/adapter.js"
        ));

        add(key, new PackageDef(
                LanguageRuntime.RUBY,
                "3.3",
                "Colocar_a_merda_do_link_aqui_gordao/ruby-" + key + ".zip",
                "zip",
                executable("ruby", target),
                executable("rdbg", target)
        ));

        add(key, new PackageDef(
                LanguageRuntime.LUA,
                "5.4",
                "Colocar_a_merda_do_link_aqui_gordao/lua-" + key + ".zip",
                "zip",
                executable("lua", target),
                "debuggers/lua-debug/adapter.lua"
        ));

        add(key, new PackageDef(
                LanguageRuntime.KOTLIN,
                "2.0",
                "Colocar_a_merda_do_link_aqui_gordao/kotlin-" + key + ".zip",
                "zip",
                executable("kotlinc", target),
                "debuggers/java-debug/com.microsoft.java.debug.plugin.jar"
        ));

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