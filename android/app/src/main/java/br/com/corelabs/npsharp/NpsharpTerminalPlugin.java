package br.com.corelabs.npsharp;

import android.content.Context;
import android.os.Environment;

import com.getcapacitor.JSArray;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

import java.io.BufferedReader;
import java.io.BufferedWriter;
import java.io.File;
import java.io.IOException;
import java.io.InputStreamReader;
import java.io.OutputStreamWriter;
import java.nio.charset.StandardCharsets;
import java.util.Map;
import java.util.UUID;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.atomic.AtomicBoolean;

/**
 * A small, persistent shell bridge for the Android app sandbox. It deliberately
 * uses the system POSIX shell instead of a remote service or a separate Termux
 * installation, so every terminal session remains private to NPSharp.
 */
@CapacitorPlugin(name = "NpsharpTerminal")
public class NpsharpTerminalPlugin extends Plugin {
    private final Map<String, ShellSession> sessions = new ConcurrentHashMap<>();

    @PluginMethod
    public void create(PluginCall call) {
        try {
            String id = UUID.randomUUID().toString();
            String name = call.getString("name", "Terminal");
            File cwd = resolveWorkspaceDirectory(call.getString("cwd", ""));
            ShellSession session = new ShellSession(id, name, cwd);
            sessions.put(id, session);
            session.start();

            JSObject result = new JSObject();
            result.put("id", id);
            result.put("name", name);
            result.put("cwd", call.getString("cwd", ""));
            result.put("shell", "/system/bin/sh");
            result.put("backend", "android-shell");
            result.put("running", true);
            call.resolve(result);
        } catch (Exception error) {
            call.reject("Não foi possível iniciar o shell Android.", error);
        }
    }

    @PluginMethod
    public void shells(PluginCall call) {
        JSObject shell = new JSObject();
        shell.put("id", "android-sh");
        shell.put("label", "Shell Android");
        shell.put("path", "/system/bin/sh");
        shell.put("available", new File("/system/bin/sh").canExecute());
        shell.put("default", true);
        shell.put("platform", "android");
        JSArray shells = new JSArray();
        shells.put(shell);
        JSObject result = new JSObject();
        result.put("shells", shells);
        call.resolve(result);
    }

    @PluginMethod
    public void write(PluginCall call) {
        ShellSession session = sessionFor(call);
        if (session == null) return;
        try {
            session.write(call.getString("data", ""));
            call.resolve();
        } catch (IOException error) {
            call.reject("Não foi possível enviar dados ao shell Android.", error);
        }
    }

    @PluginMethod
    public void resize(PluginCall call) {
        // /system/bin/sh does not expose a PTY resize API. The renderer still
        // sends dimensions so this method preserves the terminal API contract.
        if (sessionFor(call) != null) call.resolve();
    }

    @PluginMethod
    public void kill(PluginCall call) {
        ShellSession session = sessionFor(call);
        if (session == null) return;
        session.stop("SIGTERM");
        call.resolve();
    }

    @PluginMethod
    public void close(PluginCall call) {
        ShellSession session = sessionFor(call);
        if (session == null) return;
        sessions.remove(session.id);
        session.stop("SIGTERM");
        call.resolve();
    }

    @Override
    protected void handleOnDestroy() {
        for (ShellSession session : sessions.values()) session.stop("SIGTERM");
        sessions.clear();
    }

    private ShellSession sessionFor(PluginCall call) {
        String id = call.getString("id");
        ShellSession session = id == null ? null : sessions.get(id);
        if (session == null) call.reject("Sessão de terminal Android não encontrada.");
        return session;
    }

    private File resolveWorkspaceDirectory(String requestedPath) throws IOException {
        Context context = getContext();
        File documents = context.getExternalFilesDir(Environment.DIRECTORY_DOCUMENTS);
        File root = documents != null ? documents : new File(context.getFilesDir(), "documents");
        if (!root.exists() && !root.mkdirs()) throw new IOException("Não foi possível criar o diretório do terminal.");

        String relative = requestedPath == null ? "" : requestedPath.replace('\\', '/').replaceFirst("^/+", "");
        if (relative.contains("..")) relative = "";
        File target = relative.isEmpty() ? root : new File(root, relative);
        String rootPath = root.getCanonicalPath();
        String targetPath = target.getCanonicalPath();
        if (!targetPath.equals(rootPath) && !targetPath.startsWith(rootPath + File.separator)) target = root;
        if (!target.exists() && !target.mkdirs()) throw new IOException("Não foi possível abrir o diretório de trabalho do terminal.");
        return target;
    }

    private final class ShellSession {
        private final String id;
        private final String name;
        private final File cwd;
        private final AtomicBoolean closed = new AtomicBoolean(false);
        private Process process;
        private BufferedWriter input;
        private volatile String stopSignal;

        ShellSession(String id, String name, File cwd) {
            this.id = id;
            this.name = name;
            this.cwd = cwd;
        }

        void start() throws IOException {
            ProcessBuilder builder = new ProcessBuilder("/system/bin/sh", "-i");
            builder.directory(cwd);
            builder.redirectErrorStream(true);
            builder.environment().put("HOME", cwd.getAbsolutePath());
            builder.environment().put("TERM", "xterm-256color");
            builder.environment().put("PATH", "/system/bin:/system/xbin:/vendor/bin");
            process = builder.start();
            input = new BufferedWriter(new OutputStreamWriter(process.getOutputStream(), StandardCharsets.UTF_8));
            emitData("\n[NPSharp] Shell Android iniciado em " + cwd.getAbsolutePath() + "\n");
            startOutputReader();
            startExitWatcher();
        }

        synchronized void write(String data) throws IOException {
            if (closed.get() || input == null) throw new IOException("A sessão do terminal foi encerrada.");
            input.write(data);
            input.flush();
        }

        void stop(String signal) {
            if (!closed.compareAndSet(false, true)) return;
            stopSignal = signal;
            Process current = process;
            if (current == null) return;
            current.destroy();
            new Thread(() -> {
                try {
                    Thread.sleep(800);
                    if (current.isAlive()) current.destroyForcibly();
                } catch (InterruptedException error) {
                    Thread.currentThread().interrupt();
                }
            }, "npsharp-terminal-stop").start();
        }

        private void startOutputReader() {
            Thread reader = new Thread(() -> {
                try (BufferedReader output = new BufferedReader(new InputStreamReader(process.getInputStream(), StandardCharsets.UTF_8))) {
                    char[] buffer = new char[4096];
                    int count;
                    while ((count = output.read(buffer)) != -1) emitData(new String(buffer, 0, count));
                } catch (IOException error) {
                    if (!closed.get()) emitData("\n[terminal] " + error.getMessage() + "\n");
                }
            }, "npsharp-terminal-output");
            reader.setDaemon(true);
            reader.start();
        }

        private void startExitWatcher() {
            Thread watcher = new Thread(() -> {
                int code = -1;
                try {
                    code = process.waitFor();
                } catch (InterruptedException error) {
                    Thread.currentThread().interrupt();
                } finally {
                    closed.set(true);
                    sessions.remove(id, this);
                    JSObject event = new JSObject();
                    event.put("id", id);
                    event.put("code", code);
                    if (stopSignal != null) event.put("signal", stopSignal);
                    notifyListeners("exit", event);
                }
            }, "npsharp-terminal-exit");
            watcher.setDaemon(true);
            watcher.start();
        }

        private void emitData(String data) {
            JSObject event = new JSObject();
            event.put("id", id);
            event.put("data", data);
            notifyListeners("data", event);
        }
    }
}
