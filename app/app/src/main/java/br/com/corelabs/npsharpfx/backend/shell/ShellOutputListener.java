package br.com.corelabs.npsharpfx.backend.shell;

public interface ShellOutputListener {
    default void onStdout(String text) {}
    default void onStderr(String text) {}
    default void onLog(String text) {}
    default void onExit(ShellResult result) {}
}
