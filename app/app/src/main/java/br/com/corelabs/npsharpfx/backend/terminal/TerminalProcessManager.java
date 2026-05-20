package br.com.corelabs.npsharpfx.backend.terminal;

import android.content.Context;
import android.os.Handler;
import android.os.Looper;
import android.util.Log;

import br.com.corelabs.npsharpfx.backend.process.ProcessStreamPump;
import br.com.corelabs.npsharpfx.backend.shell.ShellOutputListener;
import br.com.corelabs.npsharpfx.backend.shell.ShellResult;
import br.com.corelabs.npsharpfx.backend.shell.ShellRuntime;
import br.com.corelabs.npsharpfx.backend.shell.ShellRuntimeInfo;

import java.io.OutputStream;
import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.List;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.Future;
import java.util.concurrent.ScheduledExecutorService;
import java.util.concurrent.TimeUnit;

public final class TerminalProcessManager {
    private static final String TAG = "NPSharpTerminal";
    private static final long DEFAULT_TIMEOUT_MS = 60_000L;

    private final Handler main = new Handler(Looper.getMainLooper());
    private final ExecutorService executor = Executors.newCachedThreadPool(r -> {
        Thread thread = new Thread(r, "npsharp-terminal-worker");
        thread.setDaemon(true);
        return thread;
    });
    private final ScheduledExecutorService watchdog = Executors.newSingleThreadScheduledExecutor(r -> {
        Thread thread = new Thread(r, "npsharp-terminal-watchdog");
        thread.setDaemon(true);
        return thread;
    });

    private final Context context;
    private Process process;
    private Future<?> currentTask;
    private TerminalProcessState state = TerminalProcessState.STOPPED;
    private long currentPid = -1L;
    private long startedAt;

    public TerminalProcessManager(Context context) {
        this.context = context.getApplicationContext();
    }

    public synchronized TerminalProcessState getState() {
        return state;
    }

    public synchronized long getCurrentPid() {
        return currentPid;
    }

    public synchronized boolean isAlive() {
        return process != null && process.isAlive();
    }

    public void execute(String script, TerminalProcessListener listener) {
        execute(script, listener, DEFAULT_TIMEOUT_MS);
    }

    public synchronized void execute(String script, TerminalProcessListener listener, long timeoutMs) {
        stop();
        String validation = validateScript(script);
        if (validation != null) {
            publishErr(listener, validation + "\n");
            publishState(listener, TerminalProcessState.CRASHED);
            publishFinished(listener, new ShellResult(126, "", validation + "\n", 0L, "blocked", "blocked"));
            return;
        }
        ShellRuntime.initialize(context);
        ShellRuntimeInfo runtime = ShellRuntime.runtimeInfo();
        if (!runtime.isProcessBacked()) {
            executeInternal(script, listener, timeoutMs);
            return;
        }
        publishState(listener, TerminalProcessState.RUNNING);
        currentTask = executor.submit(() -> runProcess(runtime, script == null ? "" : script, listener, timeoutMs));
    }

    public synchronized void stop() {
        killCurrent(TerminalProcessState.KILLED);
    }

    public synchronized void kill() {
        killCurrent(TerminalProcessState.KILLED);
    }

    public synchronized void restart(String script, TerminalProcessListener listener) {
        stop();
        execute(script, listener, DEFAULT_TIMEOUT_MS);
    }

    public synchronized void sendCtrlC() {
        // Android apps cannot reliably send POSIX signals to all child process groups without
        // native code. Closing stdin and destroying the direct child is the safest Java-only
        // equivalent that respects app sandbox and SELinux constraints.
        killCurrent(TerminalProcessState.KILLED);
    }

    public synchronized void shutdown() {
        killCurrent(TerminalProcessState.KILLED);
        executor.shutdownNow();
        watchdog.shutdownNow();
    }

    private void runProcess(ShellRuntimeInfo runtime, String script, TerminalProcessListener listener, long timeoutMs) {
        long start = System.currentTimeMillis();
        StringBuilder stdout = new StringBuilder();
        StringBuilder stderr = new StringBuilder();
        try {
            List<String> command = new ArrayList<>(runtime.getCommandPrefix());
            command.add("-c");
            command.add(script);
            Process local = new ProcessBuilder(command).start();
            synchronized (this) {
                process = local;
                currentPid = readPid(local);
                startedAt = start;
            }
            publishLog(listener, "runtime=" + runtime.getName() + " path=" + runtime.getExecutablePath() + " pid=" + currentPid);
            Thread out = new Thread(new ProcessStreamPump(local.getInputStream(), stdout, text -> publishOut(listener, text)), "npsharp-terminal-stdout");
            Thread err = new Thread(new ProcessStreamPump(local.getErrorStream(), stderr, text -> publishErr(listener, text)), "npsharp-terminal-stderr");
            out.start();
            err.start();
            watchdog.schedule(() -> {
                synchronized (TerminalProcessManager.this) {
                    if (process == local && local.isAlive()) {
                        publishLog(listener, "timeout: destroying pid=" + currentPid);
                        killCurrent(TerminalProcessState.KILLED);
                    }
                }
            }, Math.max(1000L, timeoutMs), TimeUnit.MILLISECONDS);
            int exit = local.waitFor();
            out.join(1000L);
            err.join(1000L);
            TerminalProcessState finalState = exit == 0 ? TerminalProcessState.FINISHED : TerminalProcessState.CRASHED;
            synchronized (this) {
                if (process == local) {
                    process = null;
                    currentPid = -1L;
                    state = finalState;
                }
            }
            ShellResult result = new ShellResult(exit, stdout.toString(), stderr.toString(), System.currentTimeMillis() - start, runtime.getName(), runtime.getExecutablePath());
            publishState(listener, finalState);
            publishFinished(listener, result);
        } catch (Exception e) {
            Log.e(TAG, "terminal process failed", e);
            synchronized (this) {
                process = null;
                currentPid = -1L;
                state = TerminalProcessState.CRASHED;
            }
            String message = stack(e);
            publishErr(listener, message + "\n");
            publishState(listener, TerminalProcessState.CRASHED);
            publishFinished(listener, new ShellResult(126, stdout.toString(), stderr + message + "\n", System.currentTimeMillis() - start, runtime.getName(), runtime.getExecutablePath()));
        }
    }

    private void executeInternal(String script, TerminalProcessListener listener, long timeoutMs) {
        publishState(listener, TerminalProcessState.RUNNING);
        currentTask = executor.submit(() -> {
            long start = System.currentTimeMillis();
            try {
                Future<ShellResult> future = executor.submit(() -> ShellRuntime.execute(script, new ShellOutputListener() {
                    @Override public void onStdout(String text) { publishOut(listener, text); }
                    @Override public void onStderr(String text) { publishErr(listener, text); }
                    @Override public void onLog(String text) { publishLog(listener, text); }
                }, timeoutMs));
                ShellResult result = future.get(timeoutMs + 1000L, TimeUnit.MILLISECONDS);
                publishState(listener, result.isSuccess() ? TerminalProcessState.FINISHED : TerminalProcessState.CRASHED);
                publishFinished(listener, result);
            } catch (Exception e) {
                String message = stack(e);
                publishErr(listener, message + "\n");
                publishState(listener, TerminalProcessState.CRASHED);
                publishFinished(listener, new ShellResult(126, "", message + "\n", System.currentTimeMillis() - start, "internal", "java-internal"));
            }
        });
    }

    private synchronized void killCurrent(TerminalProcessState nextState) {
        try {
            if (currentTask != null) currentTask.cancel(true);
        } catch (Exception ignored) {
        }
        try {
            if (process != null) {
                closeQuietly(process.getOutputStream());
                closeQuietly(process.getInputStream());
                closeQuietly(process.getErrorStream());
                process.destroy();
                if (process.isAlive()) {
                    process.destroyForcibly();
                }
            }
        } catch (Exception e) {
            Log.w(TAG, "kill failed", e);
        } finally {
            process = null;
            currentPid = -1L;
            state = nextState;
        }
    }

    private String validateScript(String script) {
        if (script == null) return null;
        if (script.indexOf('\u0000') >= 0) return "Comando invalido: contem NUL.";
        if (script.toLowerCase(java.util.Locale.ROOT).contains("/data/data/com.termux/")) {
            return "Bloqueado: Android sandbox/SELinux nao permite executar binarios privados do Termux.";
        }
        return null;
    }

    private long readPid(Process process) {
        try {
            Object value = Process.class.getMethod("pid").invoke(process);
            return value instanceof Number ? ((Number) value).longValue() : -1L;
        } catch (Exception ignored) {
            return -1L;
        }
    }

    private void closeQuietly(OutputStream stream) {
        try { if (stream != null) stream.close(); } catch (Exception ignored) {}
    }

    private void closeQuietly(java.io.InputStream stream) {
        try { if (stream != null) stream.close(); } catch (Exception ignored) {}
    }

    private void publishOut(TerminalProcessListener listener, String text) {
        if (listener != null) main.post(() -> listener.onStdout(text));
    }

    private void publishErr(TerminalProcessListener listener, String text) {
        if (listener != null) main.post(() -> listener.onStderr(text));
    }

    private void publishLog(TerminalProcessListener listener, String text) {
        Log.d(TAG, text);
        if (listener != null) main.post(() -> listener.onLog("[terminal] " + text));
    }

    private void publishState(TerminalProcessListener listener, TerminalProcessState next) {
        synchronized (this) {
            state = next;
        }
        if (listener != null) main.post(() -> listener.onStateChanged(next));
    }

    private void publishFinished(TerminalProcessListener listener, ShellResult result) {
        if (listener != null) main.post(() -> listener.onFinished(result));
    }

    private String stack(Throwable e) {
        StringBuilder builder = new StringBuilder();
        builder.append(e.getClass().getName()).append(": ").append(e.getMessage() == null ? "" : e.getMessage());
        for (StackTraceElement element : e.getStackTrace()) {
            builder.append("\n  at ").append(element);
        }
        return builder.toString();
    }
}
