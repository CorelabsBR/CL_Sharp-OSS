package br.com.corelabs.npsharpfx.backend.shell;

import br.com.corelabs.npsharpfx.backend.process.ProcessStreamPump;

import java.io.OutputStreamWriter;
import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.List;

public final class ShellSession {
    private final ShellRuntimeInfo runtime;
    private final ShellOutputListener listener;
    private Process process;
    private OutputStreamWriter stdin;
    private boolean internal;
    private boolean running;

    private ShellSession(ShellRuntimeInfo runtime, ShellOutputListener listener) {
        this.runtime = runtime;
        this.listener = listener;
    }

    static ShellSession process(ShellRuntimeInfo runtime, ShellOutputListener listener) {
        ShellSession session = new ShellSession(runtime, listener);
        session.startProcess();
        return session;
    }

    static ShellSession internal(ShellRuntimeInfo runtime, ShellOutputListener listener) {
        ShellSession session = new ShellSession(runtime, listener);
        session.internal = true;
        session.running = true;
        if (listener != null) {
            listener.onLog("[shell] interactive internal shell ativo");
        }
        return session;
    }

    public synchronized boolean isRunning() {
        return running;
    }

    public synchronized void send(String text) {
        if (!running) {
            return;
        }
        if (internal) {
            if (listener != null) {
                listener.onStderr("internal-shell: modo interativo limitado; use execute() para comandos completos.\n");
            }
            return;
        }
        try {
            stdin.write(text == null ? "" : text);
            stdin.flush();
        } catch (Exception e) {
            if (listener != null) {
                listener.onStderr("stdin falhou: " + e.getMessage() + "\n");
            }
        }
    }

    public void sendLine(String line) {
        send((line == null ? "" : line) + "\n");
    }

    public synchronized void kill() {
        running = false;
        try {
            if (stdin != null) stdin.close();
        } catch (Exception ignored) {
        }
        if (process != null) {
            process.destroyForcibly();
        }
        if (listener != null) {
            listener.onLog("[shell] sessao encerrada");
        }
    }

    public synchronized void restart() {
        kill();
        if (internal) {
            running = true;
            return;
        }
        startProcess();
    }

    private synchronized void startProcess() {
        try {
            List<String> command = new ArrayList<>(runtime.getCommandPrefix());
            process = new ProcessBuilder(command).start();
            stdin = new OutputStreamWriter(process.getOutputStream(), StandardCharsets.UTF_8);
            running = true;
            StringBuilder stdout = new StringBuilder();
            StringBuilder stderr = new StringBuilder();
            new Thread(new ProcessStreamPump(process.getInputStream(), stdout, text -> {
                if (listener != null) listener.onStdout(text);
            }), "npsharp-shell-session-stdout").start();
            new Thread(new ProcessStreamPump(process.getErrorStream(), stderr, text -> {
                if (listener != null) listener.onStderr(text);
            }), "npsharp-shell-session-stderr").start();
            new Thread(() -> {
                try {
                    int exit = process.waitFor();
                    running = false;
                    if (listener != null) {
                        listener.onExit(new ShellResult(exit, stdout.toString(), stderr.toString(), 0L, runtime.getName(), runtime.getExecutablePath()));
                    }
                } catch (Exception e) {
                    running = false;
                    if (listener != null) listener.onStderr("sessao falhou: " + e.getMessage() + "\n");
                }
            }, "npsharp-shell-session-wait").start();
            if (listener != null) {
                listener.onLog("[shell] sessao interativa: " + runtime.getName());
            }
        } catch (Exception e) {
            running = false;
            if (listener != null) {
                listener.onStderr("nao foi possivel abrir sessao: " + e.getMessage() + "\n");
            }
        }
    }
}
