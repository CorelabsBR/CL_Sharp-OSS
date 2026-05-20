package br.com.corelabs.npsharpfx.backend.shell;

import java.util.ArrayList;
import java.util.Collections;
import java.util.List;

public final class ShellRuntimeInfo {
    private final ShellRuntimeType type;
    private final String name;
    private final String executablePath;
    private final List<String> commandPrefix;
    private final boolean processBacked;

    public ShellRuntimeInfo(ShellRuntimeType type, String name, String executablePath, List<String> commandPrefix, boolean processBacked) {
        this.type = type;
        this.name = name;
        this.executablePath = executablePath == null ? "" : executablePath;
        this.commandPrefix = Collections.unmodifiableList(new ArrayList<>(commandPrefix == null ? List.of() : commandPrefix));
        this.processBacked = processBacked;
    }

    public ShellRuntimeType getType() {
        return type;
    }

    public String getName() {
        return name;
    }

    public String getExecutablePath() {
        return executablePath;
    }

    public List<String> getCommandPrefix() {
        return commandPrefix;
    }

    public boolean isProcessBacked() {
        return processBacked;
    }
}
