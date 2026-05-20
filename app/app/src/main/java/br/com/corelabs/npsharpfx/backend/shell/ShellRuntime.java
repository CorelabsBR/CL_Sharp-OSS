package br.com.corelabs.npsharpfx.backend.shell;

import android.content.Context;

import java.io.File;

public final class ShellRuntime {
    private static ShellRuntimeManager manager;

    private ShellRuntime() {}

    public static void initialize(Context context) {
        manager = ShellRuntimeManager.getInstance(context);
    }

    public static ShellResult execute(String scriptText) {
        return require().execute(scriptText);
    }

    public static ShellResult execute(String scriptText, ShellOutputListener listener) {
        return require().execute(scriptText, listener);
    }

    public static ShellResult execute(String scriptText, ShellOutputListener listener, long timeoutMs) {
        return require().execute(scriptText, listener, timeoutMs);
    }

    public static ShellResult executeFile(File file) {
        return require().executeFile(file);
    }

    public static ShellSession openInteractive(ShellOutputListener listener) {
        return require().openInteractive(listener);
    }

    public static ShellRuntimeInfo runtimeInfo() {
        return require().getRuntime();
    }

    private static ShellRuntimeManager require() {
        if (manager == null) {
            throw new IllegalStateException("ShellRuntime.initialize(context) precisa ser chamado na inicializacao.");
        }
        return manager;
    }
}
