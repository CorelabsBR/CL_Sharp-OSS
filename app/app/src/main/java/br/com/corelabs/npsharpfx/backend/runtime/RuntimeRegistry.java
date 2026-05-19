package br.com.corelabs.npsharpfx.backend.runtime;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.util.Collection;
import java.util.Collections;
import java.util.EnumMap;
import java.util.Locale;
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

    public void registerExecutable(LanguageRuntime language, Path executablePath) {
        if (language == null || executablePath == null) {
            return;
        }

        Path executable = executablePath.toAbsolutePath().normalize();
        Path root = executable.getParent() == null ? executable : executable.getParent();

        register(new InstalledRuntime(
                language,
                root,
                executable,
                null,
                "configured"
        ));
    }

    public boolean discoverFromPath(LanguageRuntime language) {
        if (language == null) {
            return false;
        }

        if (language == LanguageRuntime.PORTUGOL) {
            Path internal = RuntimePaths.toolBinDir(RuntimePaths.appDataDir()).resolve("internal-portugol");
            register(new InstalledRuntime(language, internal, internal, internal, "npsharp"));
            return true;
        }

        Optional<Path> executable = findFirstOnPath(language.executableCandidates());
        executable.ifPresent(path -> register(new InstalledRuntime(
                language,
                path.getParent(),
                path,
                null,
                "system"
        )));
        return executable.isPresent();
    }

    public int discoverAllFromPath() {
        int count = 0;

        for (LanguageRuntime language : LanguageRuntime.values()) {
            if (isInstalled(language)) {
                continue;
            }

            if (discoverFromPath(language)) {
                count++;
            }
        }

        return count;
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

    private Optional<Path> findFirstOnPath(String[] commandNames) {
        for (String command : commandNames) {
            Optional<Path> found = findOnPath(command);
            if (found.isPresent()) {
                return found;
            }
        }

        return Optional.empty();
    }

    private Optional<Path> findOnPath(String command) {
        String pathValue = System.getenv("PATH");

        if (pathValue == null || pathValue.isBlank()) {
            return Optional.empty();
        }

        boolean windows = System.getProperty("os.name", "")
                .toLowerCase(Locale.ROOT)
                .contains("win");
        String[] extensions = windows
                ? new String[] { "", ".exe", ".cmd", ".bat" }
                : new String[] { "" };

        for (String dir : pathValue.split(java.io.File.pathSeparator)) {
            if (dir == null || dir.isBlank()) {
                continue;
            }

            for (String ext : extensions) {
                Path candidate = Paths.get(dir).resolve(command + ext).normalize();

                if (Files.isRegularFile(candidate) && Files.isExecutable(candidate)) {
                    return Optional.of(candidate.toAbsolutePath().normalize());
                }
            }
        }

        return Optional.empty();
    }
}
