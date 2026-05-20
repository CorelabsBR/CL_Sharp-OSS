package br.com.corelabs.npsharpfx.backend.shell;

public final class ShellResult {
    private final int exitCode;
    private final String stdout;
    private final String stderr;
    private final long executionTimeMs;
    private final boolean success;
    private final String runtimeName;
    private final String runtimePath;

    public ShellResult(int exitCode, String stdout, String stderr, long executionTimeMs, String runtimeName, String runtimePath) {
        this.exitCode = exitCode;
        this.stdout = stdout == null ? "" : stdout;
        this.stderr = stderr == null ? "" : stderr;
        this.executionTimeMs = executionTimeMs;
        this.success = exitCode == 0;
        this.runtimeName = runtimeName == null ? "" : runtimeName;
        this.runtimePath = runtimePath == null ? "" : runtimePath;
    }

    public int getExitCode() {
        return exitCode;
    }

    public String getStdout() {
        return stdout;
    }

    public String getStderr() {
        return stderr;
    }

    public long getExecutionTimeMs() {
        return executionTimeMs;
    }

    public boolean isSuccess() {
        return success;
    }

    public String getRuntimeName() {
        return runtimeName;
    }

    public String getRuntimePath() {
        return runtimePath;
    }
}
