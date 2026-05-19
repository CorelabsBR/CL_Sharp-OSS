package br.com.corelabs.npsharpfx.backend.runtime;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.util.Collection;
import java.util.Collections;
import java.util.EnumMap;
import java.util.Map;
import java.util.Optional;
import java.util.Properties;

public final class RuntimeRegistry {

    private final Path configFile;
    private final Map<LanguageRuntime, InstalledRuntime> installed = new EnumMap<>(LanguageRuntime.class);

    public RuntimeRegistry(Path appDataDir) {
        this.configFile = RuntimePaths.configDir(appDataDir).resolve("runtime-registry.properties");
    }

    public void load() throws IOException {
        installed.clear();

        if (!Files.exists(configFile)) {
            return;
        }

        Properties props = new Properties();

        try (var in = Files.newInputStream(configFile)) {
            props.load(in);
        }

        for (LanguageRuntime lang : LanguageRuntime.values()) {
            String prefix = lang.id() + ".";

            String root = props.getProperty(prefix + "root");
            String exe = props.getProperty(prefix + "exe");
            String debugger = props.getProperty(prefix + "debugger");
            String version = props.getProperty(prefix + "version", "unknown");

            if (root == null || exe == null) {
                continue;
            }

            installed.put(lang, new InstalledRuntime(
                    lang,
                    Paths.get(root),
                    Paths.get(exe),
                    debugger == null || debugger.isBlank() ? null : Paths.get(debugger),
                    version
            ));
        }
    }

    public void save() throws IOException {
        Files.createDirectories(configFile.getParent());

        Properties props = new Properties();

        for (InstalledRuntime runtime : installed.values()) {
            String prefix = runtime.language().id() + ".";

            props.setProperty(prefix + "root", runtime.rootPath().toString());
            props.setProperty(prefix + "exe", runtime.executablePath().toString());
            props.setProperty(prefix + "version", runtime.version());

            if (runtime.debuggerPath() != null) {
                props.setProperty(prefix + "debugger", runtime.debuggerPath().toString());
            }
        }

        try (var out = Files.newOutputStream(configFile)) {
            props.store(out, "NPSharp Runtime Registry");
        }
    }

    public void register(InstalledRuntime runtime) {
        installed.put(runtime.language(), runtime);
    }

    public Optional<InstalledRuntime> get(LanguageRuntime lang) {
        return Optional.ofNullable(installed.get(lang));
    }

    public boolean isInstalled(LanguageRuntime lang) {
        if (lang == LanguageRuntime.PORTUGOL) {
            return installed.containsKey(lang);
        }

        return installed.containsKey(lang)
                && Files.exists(installed.get(lang).executablePath());
    }

    public Collection<InstalledRuntime> all() {
        return Collections.unmodifiableCollection(installed.values());
    }
}
