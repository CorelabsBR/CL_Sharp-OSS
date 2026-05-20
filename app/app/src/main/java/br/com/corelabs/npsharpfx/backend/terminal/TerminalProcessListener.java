package br.com.corelabs.npsharpfx.backend.terminal;

import br.com.corelabs.npsharpfx.backend.shell.ShellResult;

public interface TerminalProcessListener {
    default void onStdout(String text) {}
    default void onStderr(String text) {}
    default void onLog(String text) {}
    default void onStateChanged(TerminalProcessState state) {}
    default void onFinished(ShellResult result) {}
}
