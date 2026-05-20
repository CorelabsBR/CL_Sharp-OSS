package br.com.corelabs.npsharpfx.backend.shell;

import android.content.Context;
import android.os.Build;
import android.util.Log;

import br.com.corelabs.npsharpfx.backend.process.ProcessStreamPump;

import java.io.File;
import java.io.FileOutputStream;
import java.io.InputStream;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.util.ArrayList;
import java.util.List;
import java.util.Locale;
import java.util.concurrent.TimeUnit;

public final class ShellRuntimeManager {
    private static final String TAG = "NPSharpShell";
    private static final long DEFAULT_TIMEOUT_MS = 30_000L;
    private static volatile ShellRuntimeManager instance;

    private final Context context;
    private final InternalShellRuntime internalRuntime;
    private ShellRuntimeInfo runtime;

    private ShellRuntimeManager(Context context) {
        this.context = context.getApplicationContext();
        this.internalRuntime = new InternalShellRuntime(this.context);
        this.runtime = detectRuntime();
    }

    public static ShellRuntimeManager getInstance(Context context) {
        if (instance == null) {
            synchronized (ShellRuntimeManager.class) {
                if (instance == null) {
                    instance = new ShellRuntimeManager(context);
                }
            }
        }
        return instance;
    }

    public ShellRuntimeInfo getRuntime() {
        return runtime;
    }

    public ShellRuntimeInfo redetectRuntime() {
        runtime = detectRuntime();
        return runtime;
    }

    public ShellResult execute(String scriptText) {
        return execute(scriptText, null, DEFAULT_TIMEOUT_MS);
    }

    public ShellResult execute(String scriptText, ShellOutputListener listener) {
        return execute(scriptText, listener, DEFAULT_TIMEOUT_MS);
    }

    public ShellResult execute(String scriptText, ShellOutputListener listener, long timeoutMs) {
        String script = scriptText == null ? "" : scriptText;
        String validation = validateScript(script);
        if (validation != null) {
            return failure(126, validation, 0L);
        }
        ShellRuntimeInfo selected = runtime == null ? detectRuntime() : runtime;
        log(listener, "runtime=" + selected.getName() + " path=" + selected.getExecutablePath());
        if (!selected.isProcessBacked()) {
            return internalRuntime.execute(script, listener, selected.getName(), selected.getExecutablePath());
        }
        return executeProcess(selected, script, listener, timeoutMs);
    }

    public ShellResult executeFile(File file) {
        return executeFile(file, null, DEFAULT_TIMEOUT_MS);
    }

    public ShellResult executeFile(File file, ShellOutputListener listener, long timeoutMs) {
        long start = System.currentTimeMillis();
        try {
            File safe = validateExecutableFile(file);
            String script = new String(Files.readAllBytes(safe.toPath()), StandardCharsets.UTF_8);
            return execute(script, listener, timeoutMs);
        } catch (Exception e) {
            return failure(126, "executeFile: " + stack(e), System.currentTimeMillis() - start);
        }
    }

    public ShellSession openInteractive(ShellOutputListener listener) {
        ShellRuntimeInfo selected = runtime == null ? detectRuntime() : runtime;
        if (!selected.isProcessBacked()) {
            return ShellSession.internal(selected, listener);
        }
        return ShellSession.process(selected, listener);
    }

    private ShellRuntimeInfo detectRuntime() {
        // Android blocks cross-app exec such as /data/data/com.termux/... because every app
        // runs under its own Linux UID. SELinux labels and scoped storage prevent one app from
        // executing another app's private binaries, even when a path is known.
        ShellRuntimeInfo systemSh = processRuntime(ShellRuntimeType.SYSTEM_SH, "Android system sh", "/system/bin/sh", List.of("/system/bin/sh"));
        if (isExecutable("/system/bin/sh") && probe(systemSh)) {
            return systemSh;
        }

        ShellRuntimeInfo toybox = processRuntime(ShellRuntimeType.TOYBOX_SH, "Android toybox sh", "/system/bin/toybox", List.of("/system/bin/toybox", "sh"));
        if (isExecutable("/system/bin/toybox") && probe(toybox)) {
            return toybox;
        }

        ShellRuntimeInfo embedded = installEmbeddedRuntime();
        if (embedded != null && probe(embedded)) {
            return embedded;
        }

        return new ShellRuntimeInfo(ShellRuntimeType.INTERNAL, "NPSharp internal shell", "java-internal", List.of(), false);
    }

    private ShellRuntimeInfo installEmbeddedRuntime() {
        String abi = primaryAbi();
        String[] candidates = new String[] {
                "bin/" + abi + "/busybox",
                "bin/" + abi + "/bash",
                "bin/busybox",
                "bin/bash"
        };
        File binDir = new File(context.getFilesDir(), "bin");
        if (!binDir.exists() && !binDir.mkdirs()) {
            return null;
        }
        for (String asset : candidates) {
            try (InputStream input = context.getAssets().open(asset)) {
                String name = asset.substring(asset.lastIndexOf('/') + 1);
                File out = new File(binDir, name);
                try (FileOutputStream output = new FileOutputStream(out)) {
                    byte[] buffer = new byte[8192];
                    int read;
                    while ((read = input.read(buffer)) >= 0) {
                        output.write(buffer, 0, read);
                    }
                }
                if (!out.setExecutable(true, false)) {
                    Runtime.getRuntime().exec(new String[] {"/system/bin/chmod", "755", out.getAbsolutePath()}).waitFor();
                }
                if (out.canExecute()) {
                    if ("busybox".equals(name)) {
                        return processRuntime(ShellRuntimeType.EMBEDDED_BINARY, "Embedded busybox sh", out.getAbsolutePath(), List.of(out.getAbsolutePath(), "sh"));
                    }
                    return processRuntime(ShellRuntimeType.EMBEDDED_BINARY, "Embedded bash", out.getAbsolutePath(), List.of(out.getAbsolutePath()));
                }
            } catch (Exception ignored) {
                // Asset is optional. If no embedded binary is shipped, internal Java shell is used.
            }
        }
        return null;
    }

    private ShellRuntimeInfo processRuntime(ShellRuntimeType type, String name, String path, List<String> prefix) {
        return new ShellRuntimeInfo(type, name, path, prefix, true);
    }

    private boolean probe(ShellRuntimeInfo info) {
        try {
            List<String> command = new ArrayList<>(info.getCommandPrefix());
            command.add("-c");
            command.add("echo npsharp-shell-ok");
            Process process = new ProcessBuilder(command).redirectErrorStream(true).start();
            boolean finished = process.waitFor(4, TimeUnit.SECONDS);
            if (!finished) {
                process.destroyForcibly();
                return false;
            }
            return process.exitValue() == 0;
        } catch (Exception e) {
            Log.w(TAG, "probe failed for " + info.getName(), e);
            return false;
        }
    }

    private ShellResult executeProcess(ShellRuntimeInfo info, String script, ShellOutputListener listener, long timeoutMs) {
        long start = System.currentTimeMillis();
        StringBuilder stdout = new StringBuilder();
        StringBuilder stderr = new StringBuilder();
        Process process = null;
        try {
            List<String> command = new ArrayList<>(info.getCommandPrefix());
            command.add("-c");
            command.add(script);
            process = new ProcessBuilder(command).start();
            Thread outThread = new Thread(new ProcessStreamPump(process.getInputStream(), stdout, text -> {
                if (listener != null) listener.onStdout(text);
            }), "npsharp-shell-stdout");
            Thread errThread = new Thread(new ProcessStreamPump(process.getErrorStream(), stderr, text -> {
                if (listener != null) listener.onStderr(text);
            }), "npsharp-shell-stderr");
            outThread.start();
            errThread.start();
            boolean finished = process.waitFor(Math.max(1000L, timeoutMs), TimeUnit.MILLISECONDS);
            if (!finished) {
                process.destroyForcibly();
                String message = "Shell timeout after " + timeoutMs + "ms";
                if (listener != null) listener.onStderr(message + "\n");
                return new ShellResult(124, stdout.toString(), stderr + message + "\n", System.currentTimeMillis() - start, info.getName(), info.getExecutablePath());
            }
            outThread.join(1000L);
            errThread.join(1000L);
            ShellResult result = new ShellResult(process.exitValue(), stdout.toString(), stderr.toString(), System.currentTimeMillis() - start, info.getName(), info.getExecutablePath());
            if (listener != null) listener.onExit(result);
            return result;
        } catch (Exception e) {
            Log.e(TAG, "execute failed", e);
            if (process != null) process.destroyForcibly();
            String message = stack(e);
            if (listener != null) listener.onStderr(message + "\n");
            return new ShellResult(126, stdout.toString(), stderr + message + "\n", System.currentTimeMillis() - start, info.getName(), info.getExecutablePath());
        }
    }

    private boolean isExecutable(String path) {
        File file = new File(path);
        return file.exists() && file.isFile() && file.canExecute();
    }

    private String validateScript(String script) {
        if (script.indexOf('\u0000') >= 0) {
            return "Comando contem caractere NUL invalido.";
        }
        String lower = script.toLowerCase(Locale.ROOT);
        if (lower.contains("/data/data/com.termux/")) {
            return "Execucao bloqueada: Android/SELinux nao permite executar binarios privados do Termux ou de outros apps.";
        }
        return null;
    }

    private File validateExecutableFile(File file) throws Exception {
        if (file == null) {
            throw new IllegalArgumentException("Arquivo nulo.");
        }
        File canonical = file.getCanonicalFile();
        if (!canonical.isFile()) {
            throw new IllegalArgumentException("Arquivo nao existe: " + canonical);
        }
        String path = canonical.getAbsolutePath();
        if (path.contains("/data/data/com.termux/")) {
            throw new SecurityException("Caminho privado de outro app bloqueado: " + path);
        }
        return canonical;
    }

    private ShellResult failure(int exitCode, String stderr, long timeMs) {
        ShellRuntimeInfo selected = runtime == null ? ShellRuntimeInfoInternalHolder.INTERNAL : runtime;
        return new ShellResult(exitCode, "", stderr == null ? "" : stderr + "\n", timeMs, selected.getName(), selected.getExecutablePath());
    }

    private void log(ShellOutputListener listener, String text) {
        Log.d(TAG, text);
        if (listener != null) listener.onLog("[shell] " + text);
    }

    private String primaryAbi() {
        if (Build.SUPPORTED_ABIS != null && Build.SUPPORTED_ABIS.length > 0) {
            return Build.SUPPORTED_ABIS[0];
        }
        return "unknown";
    }

    private String stack(Throwable e) {
        StringBuilder builder = new StringBuilder();
        builder.append(e.getClass().getName()).append(": ").append(e.getMessage() == null ? "" : e.getMessage());
        for (StackTraceElement element : e.getStackTrace()) {
            builder.append("\n  at ").append(element);
        }
        return builder.toString();
    }

    private static final class ShellRuntimeInfoInternalHolder {
        private static final ShellRuntimeInfo INTERNAL = new ShellRuntimeInfo(ShellRuntimeType.INTERNAL, "NPSharp internal shell", "java-internal", List.of(), false);
    }
}
