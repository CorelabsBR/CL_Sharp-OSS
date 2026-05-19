package br.com.corelabs.npsharpfx.backend.runtime;

import java.nio.file.Path;

public final class InstalledRuntime {

    private final LanguageRuntime language;
    private final Path rootPath;
    private final Path executablePath;
    private final Path debuggerPath;
    private final String version;

    public InstalledRuntime(
            LanguageRuntime language,
            Path rootPath,
            Path executablePath,
            Path debuggerPath,
            String version
    ) {
        this.language = language;
        this.rootPath = rootPath;
        this.executablePath = executablePath;
        this.debuggerPath = debuggerPath;
        this.version = version;
    }

    public LanguageRuntime language() {
        return language;
    }

    public Path rootPath() {
        return rootPath;
    }

    public Path executablePath() {
        return executablePath;
    }

    public Path debuggerPath() {
        return debuggerPath;
    }

    public String version() {
        return version;
    }

    public boolean hasDebugger() {
        return debuggerPath != null;
    }
}